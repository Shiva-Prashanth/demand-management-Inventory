import os
import json
import logging
import warnings
from typing import List, Dict, Any, Union, Optional, Tuple
import numpy as np
import pandas as pd
import pywt
import joblib
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

warnings.filterwarnings("ignore")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ml-service")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = BASE_DIR
DATA_DIR = os.path.join(BASE_DIR, "..", "server", "data")

app = FastAPI(
    title="Wavelet Retail Demand Forecasting ML Service",
    description="Microservice serving wavelet-based retail demand predictions and Random Forest models.",
    version="1.0.0"
)

cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables loaded at startup
rf_trend = None
rf_spikes = None
feature_metadata = {}
metrics_data = {}
importance_data = {}
historical_df = None

def load_artifacts():
    global rf_trend, rf_spikes, feature_metadata, metrics_data, importance_data, historical_df
    trend_path = os.path.join(MODELS_DIR, "rf_trend.joblib")
    spikes_path = os.path.join(MODELS_DIR, "rf_spikes.joblib")
    cols_path = os.path.join(MODELS_DIR, "feature_columns.json")
    metrics_path = os.path.join(MODELS_DIR, "metrics.json")
    imp_path = os.path.join(MODELS_DIR, "feature_importance.json")
    
    if os.path.exists(trend_path) and os.path.exists(spikes_path):
        rf_trend = joblib.load(trend_path)
        rf_spikes = joblib.load(spikes_path)
        logger.info("Loaded rf_trend and rf_spikes models.")
    else:
        logger.warning("Models not found! Please run train.py first.")

    if os.path.exists(cols_path):
        with open(cols_path, "r", encoding="utf-8") as f:
            feature_metadata = json.load(f)
            
    if os.path.exists(metrics_path):
        with open(metrics_path, "r", encoding="utf-8") as f:
            metrics_data = json.load(f)

    if os.path.exists(imp_path):
        with open(imp_path, "r", encoding="utf-8") as f:
            importance_data = json.load(f)

    csv_path = os.path.join(DATA_DIR, "Demand Forecasting Dataset.csv")
    if os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
            df['Date'] = pd.to_datetime(df['Date'])
            df = df.sort_values(by=['Store ID', 'Product ID', 'Date']).reset_index(drop=True)
            historical_df = df
            logger.info(f"Loaded historical dataset with {len(df)} rows.")
        except Exception as e:
            logger.error(f"Error loading historical dataset: {e}")

load_artifacts()

class FeatureItem(BaseModel):
    Price: Optional[float] = 50.0
    Competitor_Pricing: Optional[float] = Field(50.0, alias="Competitor Pricing")
    Inventory_Level: Optional[float] = Field(100.0, alias="Inventory Level")
    Promotion: Optional[float] = 0.0
    Discount: Optional[float] = 0.0
    Epidemic: Optional[float] = 0.0
    Weather_Condition: Optional[str] = Field("Sunny", alias="Weather Condition")
    Seasonality: Optional[str] = "Summer"

    class Config:
        populate_by_name = True
        extra = "allow"

class PredictRequest(BaseModel):
    store_id: str = Field(..., description="Store identifier, e.g., 'S001'")
    product_id: str = Field(..., description="Product identifier, e.g., 'P0001'")
    features: Union[Dict[str, Any], List[Dict[str, Any]]] = Field(..., description="Single feature dict or list of feature dicts")

    @field_validator("store_id")
    def validate_store_id(cls, v):
        valid_stores = feature_metadata.get("unique_stores", [])
        if valid_stores and v not in valid_stores:
            raise ValueError(f"Unknown Store ID '{v}'. Valid Store IDs are: {', '.join(valid_stores)}")
        return v

    @field_validator("product_id")
    def validate_product_id(cls, v):
        valid_products = feature_metadata.get("unique_products", [])
        if valid_products and v not in valid_products:
            raise ValueError(f"Unknown Product ID '{v}'. Valid Product IDs are: {', '.join(valid_products)}")
        return v

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ml-service",
        "models_loaded": rf_trend is not None and rf_spikes is not None
    }

@app.get("/metrics")
def get_metrics():
    if not metrics_data:
        raise HTTPException(status_code=404, detail="Metrics not found. Please train models first.")
    return metrics_data

@app.get("/feature-importance")
def get_feature_importance():
    if not importance_data:
        raise HTTPException(status_code=404, detail="Feature importance data not found. Please train models first.")
    return importance_data

def prepare_feature_row(feat_dict: Dict[str, Any], macro_cols: List[str], transient_cols: List[str]) -> Tuple[Dict[str, float], Dict[str, float]]:
    price = float(feat_dict.get("Price", feat_dict.get("price", 50.0)))
    comp_price = float(feat_dict.get("Competitor Pricing", feat_dict.get("Competitor_Pricing", feat_dict.get("competitorPricing", 50.0))))
    inv_level = float(feat_dict.get("Inventory Level", feat_dict.get("Inventory_Level", feat_dict.get("inventoryLevel", 100.0))))
    promotion = float(feat_dict.get("Promotion", feat_dict.get("promotion", 0.0)))
    discount = float(feat_dict.get("Discount", feat_dict.get("discount", 0.0)))
    epidemic = float(feat_dict.get("Epidemic", feat_dict.get("epidemic", 0.0)))

    seasonality = str(feat_dict.get("Seasonality", feat_dict.get("seasonality", "Summer"))).strip()
    weather = str(feat_dict.get("Weather Condition", feat_dict.get("Weather_Condition", feat_dict.get("weather", "Sunny")))).strip()

    macro_row = {
        "Price": price,
        "Competitor Pricing": comp_price,
        "Inventory Level": inv_level
    }
    for col in macro_cols:
        if col.startswith("Seasonality_"):
            season_name = col.replace("Seasonality_", "")
            if col in feat_dict:
                macro_row[col] = float(feat_dict[col])
            else:
                macro_row[col] = 1.0 if seasonality.lower() == season_name.lower() else 0.0

    transient_row = {
        "Promotion": promotion,
        "Discount": discount,
        "Epidemic": epidemic
    }
    for col in transient_cols:
        if col.startswith("Weather Condition_"):
            w_name = col.replace("Weather Condition_", "")
            if col in feat_dict:
                transient_row[col] = float(feat_dict[col])
            else:
                transient_row[col] = 1.0 if weather.lower() == w_name.lower() else 0.0

    return macro_row, transient_row

@app.post("/predict")
def predict(request: PredictRequest):
    if rf_trend is None or rf_spikes is None:
        raise HTTPException(status_code=500, detail="Models not loaded. Run train.py first.")

    raw_features = request.features
    if isinstance(raw_features, dict):
        feature_list = [raw_features]
        single_item = True
    elif isinstance(raw_features, list):
        if len(raw_features) == 0:
            raise HTTPException(status_code=400, detail="features list cannot be empty")
        feature_list = raw_features
        single_item = (len(raw_features) == 1)
    else:
        raise HTTPException(status_code=400, detail="features must be a dictionary or list of dictionaries")

    macro_cols = feature_metadata.get("macro_features", [
        'Price', 'Competitor Pricing', 'Inventory Level',
        'Seasonality_Spring', 'Seasonality_Summer', 'Seasonality_Winter'
    ])
    transient_cols = feature_metadata.get("transient_features", [
        'Promotion', 'Discount', 'Epidemic',
        'Weather Condition_Rainy', 'Weather Condition_Snowy', 'Weather Condition_Sunny'
    ])

    macro_rows = []
    transient_rows = []
    for item in feature_list:
        m_row, t_row = prepare_feature_row(item, macro_cols, transient_cols)
        macro_rows.append(m_row)
        transient_rows.append(t_row)

    df_macro = pd.DataFrame(macro_rows)[macro_cols]
    df_transient = pd.DataFrame(transient_rows)[transient_cols]

    pred_cA = rf_trend.predict(df_macro)
    pred_cD = rf_spikes.predict(df_transient)

    num_samples = len(pred_cA)
    # db4 filter length is 8; idwt output length < input length when n < 8,
    # causing silent truncation. Use the fast approximation for small batches.
    if num_samples >= 8:
        reconstructed = pywt.idwt(pred_cA, pred_cD, 'db4')[:num_samples]
    else:
        reconstructed = (pred_cA + pred_cD) / np.sqrt(2)

    pred_trend = pred_cA / np.sqrt(2)
    pred_spike = pred_cD / np.sqrt(2)

    if single_item:
        return {
            "store_id": request.store_id,
            "product_id": request.product_id,
            "predicted_cA": round(float(pred_cA[0]), 4),
            "predicted_cD": round(float(pred_cD[0]), 4),
            "predicted_trend": round(float(pred_trend[0]), 4),
            "predicted_spike": round(float(pred_spike[0]), 4),
            "reconstructed_demand": round(float(reconstructed[0]), 4),
            "is_single": True
        }
    else:
        return {
            "store_id": request.store_id,
            "product_id": request.product_id,
            "predicted_cA": [round(float(v), 4) for v in pred_cA],
            "predicted_cD": [round(float(v), 4) for v in pred_cD],
            "predicted_trend": [round(float(v), 4) for v in pred_trend],
            "predicted_spike": [round(float(v), 4) for v in pred_spike],
            "reconstructed_demand": [round(float(v), 4) for v in reconstructed],
            "is_single": False,
            "count": num_samples
        }

@app.get("/wavelet-decomposition")
def get_wavelet_decomposition(
    store_id: str = Query(..., description="Store ID"),
    product_id: str = Query(..., description="Product ID")
):
    if historical_df is None:
        raise HTTPException(status_code=500, detail="Historical dataset not loaded.")

    subset = historical_df[(historical_df['Store ID'] == store_id) & (historical_df['Product ID'] == product_id)]
    if subset.empty:
        raise HTTPException(status_code=404, detail=f"No data found for Store {store_id} and Product {product_id}")

    subset = subset.sort_values(by='Date').reset_index(drop=True)
    demand = subset['Demand'].values
    dates = subset['Date'].dt.strftime('%Y-%m-%d').tolist()

    if len(demand) < 8:
        raise HTTPException(status_code=400, detail="Not enough data points for wavelet decomposition (minimum 8 required).")

    cA, cD = pywt.dwt(demand, 'db4')
    coeff_len = len(cA)
    step = len(demand) / coeff_len
    coeff_dates = [dates[min(int(i * step), len(dates) - 1)] for i in range(coeff_len)]

    # Normalized trend and spike signal on the original time scale for stacked visualization
    cA_upsampled = np.interp(np.linspace(0, 1, len(demand)), np.linspace(0, 1, len(cA)), cA / np.sqrt(2))
    cD_upsampled = np.interp(np.linspace(0, 1, len(demand)), np.linspace(0, 1, len(cD)), cD / np.sqrt(2))

    return {
        "store_id": store_id,
        "product_id": product_id,
        "signal_length": len(demand),
        "coeff_length": coeff_len,
        "wavelet": "db4",
        "dates": dates,
        "original_demand": [round(float(v), 2) for v in demand],
        "cA_raw": [round(float(v), 2) for v in cA],
        "cD_raw": [round(float(v), 2) for v in cD],
        "coeff_dates": coeff_dates,
        "aligned_trend": [round(float(v), 2) for v in cA_upsampled],
        "aligned_spikes": [round(float(v), 2) for v in cD_upsampled]
    }

store_product_cache = None

def get_store_product_baselines():
    global store_product_cache
    if store_product_cache is not None:
        return store_product_cache
    if historical_df is None:
        return []
    pairs_df = historical_df[['Store ID', 'Product ID', 'Category', 'Region']].drop_duplicates()
    medians = historical_df.groupby(['Store ID', 'Product ID'])[['Price', 'Competitor Pricing', 'Inventory Level', 'Discount', 'Promotion']].median().reset_index()
    merged = pd.merge(pairs_df, medians, on=['Store ID', 'Product ID'])
    store_product_cache = merged.to_dict('records')
    return store_product_cache

@app.get("/forecast-timeline")
@app.post("/forecast-timeline")
def forecast_timeline(
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
    store_id: Optional[str] = Query(None, description="Store ID or ALL"),
    product_id: Optional[str] = Query(None, description="Product ID or ALL"),
    category: Optional[str] = Query(None, description="Category or ALL"),
    region: Optional[str] = Query(None, description="Region or ALL"),
    weather: Optional[str] = Query(None, description="Weather or ALL"),
    seasonality: Optional[str] = Query(None, description="Seasonality or ALL")
):
    if rf_trend is None or rf_spikes is None:
        raise HTTPException(status_code=500, detail="Models not loaded.")

    try:
        dt_start = pd.to_datetime(start_date)
        dt_end = pd.to_datetime(end_date)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")

    if dt_start > dt_end:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")

    date_range = pd.date_range(dt_start, dt_end, freq='D')
    if len(date_range) > 730:
        date_range = date_range[:730]

    baselines = get_store_product_baselines()
    if not baselines:
        raise HTTPException(status_code=500, detail="Store/Product baselines not available.")

    filtered_pairs = []
    for b in baselines:
        if store_id and store_id.upper() != 'ALL' and b['Store ID'] != store_id:
            continue
        if product_id and product_id.upper() != 'ALL' and b['Product ID'] != product_id:
            continue
        if category and category.upper() != 'ALL' and b['Category'].lower() != category.lower():
            continue
        if region and region.upper() != 'ALL' and b['Region'].lower() != region.lower():
            continue
        filtered_pairs.append(b)

    if not filtered_pairs:
        return {"success": True, "start_date": start_date, "end_date": end_date, "count": 0, "records": []}

    macro_cols = feature_metadata.get("macro_features", [
        'Price', 'Competitor Pricing', 'Inventory Level',
        'Seasonality_Spring', 'Seasonality_Summer', 'Seasonality_Winter'
    ])
    transient_cols = feature_metadata.get("transient_features", [
        'Promotion', 'Discount', 'Epidemic',
        'Weather Condition_Rainy', 'Weather Condition_Snowy', 'Weather Condition_Sunny'
    ])

    season_map = {
        12: 'Winter', 1: 'Winter', 2: 'Winter',
        3: 'Spring', 4: 'Spring', 5: 'Spring',
        6: 'Summer', 7: 'Summer', 8: 'Summer',
        9: 'Autumn', 10: 'Autumn', 11: 'Autumn'
    }

    rows_macro = []
    rows_transient = []
    meta_list = []

    for d in date_range:
        d_str = d.strftime('%Y-%m-%d')
        month = d.month
        day_of_week = d.dayofweek

        if seasonality and seasonality.upper() != 'ALL':
            cur_season = seasonality
        else:
            cur_season = season_map.get(month, 'Summer')

        if weather and weather.upper() != 'ALL':
            cur_weather = weather
        else:
            if cur_season == 'Winter':
                cur_weather = 'Snowy' if (d.day % 4 == 0) else ('Cloudy' if (d.day % 3 == 0) else 'Sunny')
            elif cur_season == 'Summer':
                cur_weather = 'Sunny' if (d.day % 5 != 0) else 'Rainy'
            elif cur_season == 'Spring':
                cur_weather = 'Sunny' if (d.day % 3 == 0) else 'Rainy'
            else:
                cur_weather = 'Rainy' if (d.day % 3 == 0) else 'Sunny'

        is_weekend = day_of_week in [5, 6]

        for p in filtered_pairs:
            s_id = p['Store ID']
            prod_id = p['Product ID']
            cat = p['Category']
            reg = p['Region']

            price = float(p.get('Price', 50.0))
            comp_price = float(p.get('Competitor Pricing', 50.0))
            inv = float(p.get('Inventory Level', 100.0))
            disc = float(p.get('Discount', 0.0))
            promo = 1.0 if (is_weekend and d.day % 2 == 0) else float(p.get('Promotion', 0.0))

            feat = {
                'Price': price,
                'Competitor Pricing': comp_price,
                'Inventory Level': inv,
                'Promotion': promo,
                'Discount': disc,
                'Epidemic': 0.0,
                'Weather Condition': cur_weather,
                'Seasonality': cur_season
            }
            m_row, t_row = prepare_feature_row(feat, macro_cols, transient_cols)
            rows_macro.append(m_row)
            rows_transient.append(t_row)
            meta_list.append((d_str, s_id, prod_id, cat, reg, price, comp_price, inv, disc, promo, cur_weather, cur_season))

    df_m = pd.DataFrame(rows_macro)[macro_cols]
    df_t = pd.DataFrame(rows_transient)[transient_cols]

    pred_cA = rf_trend.predict(df_m)
    pred_cD = rf_spikes.predict(df_t)
    # Use idwt when we have enough samples (db4 filter length = 8); otherwise
    # fall back to the fast approximation — same logic as /predict endpoint.
    n_total = len(pred_cA)
    if n_total >= 8:
        demand_reconstructed = pywt.idwt(pred_cA, pred_cD, 'db4')[:n_total]
    else:
        demand_reconstructed = (pred_cA + pred_cD) / np.sqrt(2)

    records = []
    for idx, (cA, cD, dem) in enumerate(zip(pred_cA, pred_cD, demand_reconstructed)):
        m = meta_list[idx]
        records.append({
            "date": m[0],
            "storeId": m[1],
            "productId": m[2],
            "category": m[3],
            "region": m[4],
            "price": round(float(m[5]), 2),
            "competitorPricing": round(float(m[6]), 2),
            "inventoryLevel": round(float(m[7]), 2),
            "discount": round(float(m[8]), 2),
            "promotion": round(float(m[9]), 2),
            "weatherCondition": m[10],
            "seasonality": m[11],
            "epidemic": 0.0,
            "predicted_cA": round(float(cA), 2),
            "predicted_cD": round(float(cD), 2),
            "demand": max(5.0, round(float(dem), 2)),
            "isForecast": True
        })

    return {
        "success": True,
        "start_date": start_date,
        "end_date": end_date,
        "count": len(records),
        "records": records
    }

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)

