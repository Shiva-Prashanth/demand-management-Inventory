import os
import sys
import json
import logging
import numpy as np
import pandas as pd
import pywt
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train")

def downsample_features_simple(feature_series, target_len):
    """
    Downsamples a feature series to a target length by averaging segments.
    Matches the exact notebook implementation.
    """
    if len(feature_series) == 0 or target_len == 0:
        return np.array([])
    
    resampled_features = []
    step = len(feature_series) / target_len
    for i in range(target_len):
        start = int(i * step)
        end = int((i + 1) * step)
        if start >= len(feature_series) or start == end:
            if len(feature_series) > 0:
                resampled_features.append(float(feature_series.iloc[-1]))
            else:
                resampled_features.append(np.nan)
        else:
            resampled_features.append(float(feature_series.iloc[start:end].mean()))
    return np.array(resampled_features)

def apply_dwt_and_align_features(group_df, macro_features, transient_features, wavelet='db4'):
    """
    Applies single-level DWT on demand series and downsamples aligned features.
    """
    demand_series = group_df['Demand'].values
    min_len = pywt.Wavelet(wavelet).dec_len # 8 for db4
    if len(demand_series) < min_len:
        return pd.DataFrame(), pd.DataFrame()
    
    cA, cD = pywt.dwt(demand_series, wavelet)
    num_coeffs = len(cA)

    aligned_macro = {}
    for feat in macro_features:
        aligned_macro[feat] = downsample_features_simple(group_df[feat], num_coeffs)

    aligned_transient = {}
    for feat in transient_features:
        aligned_transient[feat] = downsample_features_simple(group_df[feat], num_coeffs)

    if not all(len(arr) == num_coeffs for arr in aligned_macro.values()):
        return pd.DataFrame(), pd.DataFrame()
    if not all(len(arr) == num_coeffs for arr in aligned_transient.values()):
        return pd.DataFrame(), pd.DataFrame()

    df_cA = pd.DataFrame({**aligned_macro, 'cA_target': cA})
    df_cD = pd.DataFrame({**aligned_transient, 'cD_target': cD})

    s_id = group_df['Store ID'].iloc[0]
    p_id = group_df['Product ID'].iloc[0]
    df_cA['Store ID'] = s_id
    df_cA['Product ID'] = p_id
    df_cD['Store ID'] = s_id
    df_cD['Product ID'] = p_id

    return df_cA, df_cD

def train():
    # Resolve dataset path
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "server", "data", "Demand Forecasting Dataset.csv"),
        os.path.join(os.path.dirname(__file__), "data", "Demand Forecasting Dataset.csv"),
        os.path.join(os.getcwd(), "server", "data", "Demand Forecasting Dataset.csv"),
        os.path.join(os.getcwd(), "Demand Forecasting Dataset.csv")
    ]
    data_path = None
    for p in possible_paths:
        if os.path.exists(p):
            data_path = os.path.abspath(p)
            break
            
    if not data_path:
        logger.error("Dataset 'Demand Forecasting Dataset.csv' not found.")
        sys.exit(1)
        
    logger.info(f"Loading dataset from: {data_path}")
    df = pd.read_csv(data_path)
    logger.info(f"Loaded {len(df)} rows. Columns: {df.columns.tolist()}")

    # 1. Parse Date, sort by Store ID, Product ID, Date
    df['Date'] = pd.to_datetime(df['Date'])
    df = df.sort_values(by=['Store ID', 'Product ID', 'Date']).reset_index(drop=True)

    # 2. One-hot encode Category, Region, Weather Condition, Seasonality with drop_first=True
    cols_to_encode = ['Category', 'Region', 'Weather Condition', 'Seasonality']
    # Record unique categories and values for metadata
    unique_stores = sorted(df['Store ID'].unique().tolist())
    unique_products = sorted(df['Product ID'].unique().tolist())
    unique_categories = sorted(df['Category'].unique().tolist())
    unique_regions = sorted(df['Region'].unique().tolist())
    unique_weathers = sorted(df['Weather Condition'].unique().tolist())
    unique_seasonalities = sorted(df['Seasonality'].unique().tolist())

    df_encoded = pd.get_dummies(df, columns=cols_to_encode, drop_first=True)

    # 4. Feature split:
    # Macro (trend): Price, Competitor Pricing, Inventory Level, plus Seasonality columns
    # Transient (spikes): Promotion, Discount, Epidemic, plus Weather Condition columns
    macro_inputs = ['Price', 'Competitor Pricing', 'Inventory Level']
    transient_inputs = ['Promotion', 'Discount', 'Epidemic']

    seasonality_encoded_cols = [c for c in df_encoded.columns if c.startswith('Seasonality_')]
    weather_encoded_cols = [c for c in df_encoded.columns if c.startswith('Weather Condition_')]

    macro_inputs.extend(seasonality_encoded_cols)
    transient_inputs.extend(weather_encoded_cols)

    logger.info(f"Macro features ({len(macro_inputs)}): {macro_inputs}")
    logger.info(f"Transient features ({len(transient_inputs)}): {transient_inputs}")

    # 3. For each (Store ID, Product ID) group, apply single-level DWT with db4
    all_cA_list = []
    all_cD_list = []

    grouped = df_encoded.groupby(['Store ID', 'Product ID'])
    for (s_id, p_id), group in grouped:
        df_cA_grp, df_cD_grp = apply_dwt_and_align_features(group, macro_inputs, transient_inputs, wavelet='db4')
        if not df_cA_grp.empty and not df_cD_grp.empty:
            all_cA_list.append(df_cA_grp)
            all_cD_list.append(df_cD_grp)

    all_cA_data = pd.concat(all_cA_list, ignore_index=True)
    all_cD_data = pd.concat(all_cD_list, ignore_index=True)

    logger.info(f"Decomposition complete. cA data shape: {all_cA_data.shape}, cD data shape: {all_cD_data.shape}")

    # 5. Train two RandomForestRegressor models (n_estimators=100, random_state=42)
    X_cA = all_cA_data[macro_inputs]
    y_cA = all_cA_data['cA_target']
    X_cD = all_cD_data[transient_inputs]
    y_cD = all_cD_data['cD_target']

    # Synchronized train/test split (20% test size, random_state=42)
    (X_cA_train, X_cA_test,
     y_cA_train, y_cA_test,
     X_cD_train, X_cD_test,
     y_cD_train, y_cD_test,
     store_train, store_test,
     prod_train, prod_test,
     idx_train, idx_test) = train_test_split(
         X_cA, y_cA,
         X_cD, y_cD,
         all_cA_data['Store ID'], all_cA_data['Product ID'],
         all_cA_data.index,
         test_size=0.2, random_state=42
    )

    logger.info("Training RF_Trend (Model A)...")
    rf_trend = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    rf_trend.fit(X_cA_train, y_cA_train)

    logger.info("Training RF_Spikes (Model B)...")
    rf_spikes = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    rf_spikes.fit(X_cD_train, y_cD_train)

    # Predictions
    y_cA_pred = rf_trend.predict(X_cA_test)
    y_cD_pred = rf_spikes.predict(X_cD_test)

    mse_cA = float(mean_squared_error(y_cA_test, y_cA_pred))
    r2_cA = float(r2_score(y_cA_test, y_cA_pred))

    mse_cD = float(mean_squared_error(y_cD_test, y_cD_pred))
    r2_cD = float(r2_score(y_cD_test, y_cD_pred))

    logger.info(f"RF_Trend  - MSE: {mse_cA:.4f}, R²: {r2_cA:.4f}")
    logger.info(f"RF_Spikes - MSE: {mse_cD:.4f}, R²: {r2_cD:.4f}")

    # 6. Reconstruct demand with pywt.idwt(predicted_cA, predicted_cD, 'db4')
    test_eval_df = pd.DataFrame({
        'original_index': idx_test,
        'Store ID': store_test,
        'Product ID': prod_test,
        'actual_cA': y_cA_test,
        'pred_cA': y_cA_pred,
        'actual_cD': y_cD_test,
        'pred_cD': y_cD_pred
    })

    final_predicted_list = []
    final_actual_list = []

    for (s_id, p_id), grp in test_eval_df.groupby(['Store ID', 'Product ID']):
        grp_sorted = grp.sort_values(by='original_index').reset_index(drop=True)
        p_cA = grp_sorted['pred_cA'].values
        p_cD = grp_sorted['pred_cD'].values
        a_cA = grp_sorted['actual_cA'].values
        a_cD = grp_sorted['actual_cD'].values

        if len(p_cA) >= 4 and len(p_cA) == len(p_cD):
            rec_pred = pywt.idwt(p_cA, p_cD, 'db4')
            rec_act = pywt.idwt(a_cA, a_cD, 'db4')

            final_predicted_list.append(pd.DataFrame({
                'Store ID': s_id,
                'Product ID': p_id,
                'Reconstructed_Predicted_Demand': rec_pred
            }))
            final_actual_list.append(pd.DataFrame({
                'Store ID': s_id,
                'Product ID': p_id,
                'Reconstructed_Actual_Demand': rec_act
            }))

    if final_predicted_list and final_actual_list:
        final_predicted_df = pd.concat(final_predicted_list, ignore_index=True)
        final_actual_df = pd.concat(final_actual_list, ignore_index=True)

        final_mse = float(mean_squared_error(final_actual_df['Reconstructed_Actual_Demand'], final_predicted_df['Reconstructed_Predicted_Demand']))
        final_r2 = float(r2_score(final_actual_df['Reconstructed_Actual_Demand'], final_predicted_df['Reconstructed_Predicted_Demand']))
    else:
        final_mse = float(mse_cA + mse_cD)
        final_r2 = float((r2_cA + r2_cD) / 2)

    logger.info(f"Reconstructed Demand - MSE: {final_mse:.4f}, R²: {final_r2:.4f}")

    # Feature importances
    trend_importances = [
        {"feature": feat, "importance": round(float(imp), 4)}
        for feat, imp in sorted(zip(macro_inputs, rf_trend.feature_importances_), key=lambda x: x[1], reverse=True)
    ]
    spikes_importances = [
        {"feature": feat, "importance": round(float(imp), 4)}
        for feat, imp in sorted(zip(transient_inputs, rf_spikes.feature_importances_), key=lambda x: x[1], reverse=True)
    ]

    metrics = {
        "rf_trend": {
            "mse": round(mse_cA, 4),
            "r2": round(r2_cA, 4),
            "mae": round(float(np.mean(np.abs(y_cA_test - y_cA_pred))), 4)
        },
        "rf_spikes": {
            "mse": round(mse_cD, 4),
            "r2": round(r2_cD, 4),
            "mae": round(float(np.mean(np.abs(y_cD_test - y_cD_pred))), 4)
        },
        "reconstructed": {
            "mse": round(final_mse, 4),
            "r2": round(final_r2, 4)
        },
        "details": {
            "n_train_samples": int(len(X_cA_train)),
            "n_test_samples": int(len(X_cA_test)),
            "wavelet": "db4",
            "model_type": "RandomForestRegressor(n_estimators=100, random_state=42)"
        }
    }

    feature_columns = {
        "macro_features": macro_inputs,
        "transient_features": transient_inputs,
        "categorical_columns": cols_to_encode,
        "seasonality_encoded_cols": seasonality_encoded_cols,
        "weather_encoded_cols": weather_encoded_cols,
        "unique_stores": unique_stores,
        "unique_products": unique_products,
        "unique_categories": unique_categories,
        "unique_regions": unique_regions,
        "unique_weathers": unique_weathers,
        "unique_seasonalities": unique_seasonalities
    }

    # Save artifacts in ml-service directory
    out_dir = os.path.dirname(os.path.abspath(__file__))
    
    rf_trend_path = os.path.join(out_dir, "rf_trend.joblib")
    rf_spikes_path = os.path.join(out_dir, "rf_spikes.joblib")
    feature_cols_path = os.path.join(out_dir, "feature_columns.json")
    metrics_path = os.path.join(out_dir, "metrics.json")
    importance_path = os.path.join(out_dir, "feature_importance.json")

    logger.info(f"Saving models and artifacts to {out_dir}...")
    joblib.dump(rf_trend, rf_trend_path, compress=3)
    joblib.dump(rf_spikes, rf_spikes_path, compress=3)

    with open(feature_cols_path, "w", encoding="utf-8") as f:
        json.dump(feature_columns, f, indent=2)

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    with open(importance_path, "w", encoding="utf-8") as f:
        json.dump({
            "rf_trend": trend_importances,
            "rf_spikes": spikes_importances
        }, f, indent=2)

    logger.info("Artifacts successfully saved:")
    logger.info(f" - {rf_trend_path}")
    logger.info(f" - {rf_spikes_path}")
    logger.info(f" - {feature_cols_path}")
    logger.info(f" - {metrics_path}")
    logger.info(f" - {importance_path}")
    logger.info("Training pipeline finished successfully.")

if __name__ == "__main__":
    train()
