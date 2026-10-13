const fs = require('fs');
const csv = require('csv-parser');
const config = require('../config');
const mlService = require('./mlService');

class DataService {
  constructor() {
    this.records = [];
    this.isLoaded = false;
    this.uniqueFilters = null;
    this.minDate = null;
    this.maxDate = null;
    this.baselines = new Map();

    // In-memory cache for generated future forecast records
    this.futureRecords = [];
    this.futureDatesCached = new Set();
  }

  async loadData() {
    return new Promise((resolve, reject) => {
      const results = [];
      const filePath = config.dataPath;

      if (!fs.existsSync(filePath)) {
        return reject(new Error(`CSV dataset not found at path: ${filePath}`));
      }

      console.log(`[DataService] Loading CSV dataset from: ${filePath}...`);
      const startTime = Date.now();

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          const record = {
            date: data.Date ? data.Date.trim() : '',
            storeId: data['Store ID'] ? data['Store ID'].trim() : '',
            productId: data['Product ID'] ? data['Product ID'].trim() : '',
            category: data.Category ? data.Category.trim() : '',
            region: data.Region ? data.Region.trim() : '',
            inventoryLevel: parseFloat(data['Inventory Level'] || 0),
            unitsSold: parseFloat(data['Units Sold'] || 0),
            unitsOrdered: parseFloat(data['Units Ordered'] || 0),
            price: parseFloat(data.Price || 0),
            discount: parseFloat(data.Discount || 0),
            weatherCondition: data['Weather Condition'] ? data['Weather Condition'].trim() : '',
            promotion: parseFloat(data.Promotion || 0),
            competitorPricing: parseFloat(data['Competitor Pricing'] || 0),
            seasonality: data.Seasonality ? data.Seasonality.trim() : '',
            epidemic: parseFloat(data.Epidemic || 0),
            demand: parseFloat(data.Demand || 0),
            isForecast: false
          };
          results.push(record);
        })
        .on('end', () => {
          this.records = results;
          this.isLoaded = true;
          this.buildFilterIndex();
          this.computeStoreProductBaselines();
          console.log(`[DataService] Successfully loaded ${this.records.length} records in ${Date.now() - startTime}ms.`);
          resolve(this.records.length);
        })
        .on('error', (err) => {
          console.error('[DataService] Error parsing CSV:', err);
          reject(err);
        });
    });
  }

  buildFilterIndex() {
    const stores = new Set();
    const products = new Set();
    const categories = new Set();
    const regions = new Set();
    const weathers = new Set();
    const seasonalities = new Set();
    let minDate = null;
    let maxDate = null;

    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      if (r.storeId) stores.add(r.storeId);
      if (r.productId) products.add(r.productId);
      if (r.category) categories.add(r.category);
      if (r.region) regions.add(r.region);
      if (r.weatherCondition) weathers.add(r.weatherCondition);
      if (r.seasonality) seasonalities.add(r.seasonality);

      if (r.date) {
        if (!minDate || r.date < minDate) minDate = r.date;
        if (!maxDate || r.date > maxDate) maxDate = r.date;
      }
    }

    this.minDate = minDate || '2022-01-01';
    this.maxDate = maxDate || '2024-01-30';

    this.uniqueFilters = {
      stores: Array.from(stores).sort(),
      products: Array.from(products).sort(),
      categories: Array.from(categories).sort(),
      regions: Array.from(regions).sort(),
      weathers: Array.from(weathers).sort(),
      seasonalities: Array.from(seasonalities).sort(),
      minDate: this.minDate,
      maxDate: this.maxDate,
      forecastHorizonMax: '2026-12-31'
    };
  }

  computeStoreProductBaselines() {
    const statsMap = new Map();

    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      const key = `${r.storeId}|${r.productId}`;
      let stat = statsMap.get(key);
      if (!stat) {
        stat = {
          storeId: r.storeId,
          productId: r.productId,
          category: r.category,
          region: r.region,
          priceSum: 0,
          compPriceSum: 0,
          invSum: 0,
          discSum: 0,
          promoSum: 0,
          demandSum: 0,
          count: 0
        };
        statsMap.set(key, stat);
      }
      stat.priceSum += r.price;
      stat.compPriceSum += r.competitorPricing;
      stat.invSum += r.inventoryLevel;
      stat.discSum += r.discount;
      stat.promoSum += r.promotion;
      stat.demandSum += r.demand;
      stat.count++;
    }

    statsMap.forEach((val, key) => {
      this.baselines.set(key, {
        storeId: val.storeId,
        productId: val.productId,
        category: val.category,
        region: val.region,
        price: Math.round((val.priceSum / val.count) * 100) / 100,
        competitorPricing: Math.round((val.compPriceSum / val.count) * 100) / 100,
        inventoryLevel: Math.round((val.invSum / val.count) * 10) / 10,
        discount: Math.round((val.discSum / val.count) * 10) / 10,
        promotion: Math.round((val.promoSum / val.count) * 100) / 100,
        avgDemand: Math.round((val.demandSum / val.count) * 100) / 100
      });
    });
  }

  getNextDate(dateStr) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  generateFallbackFutureRecords(startDate, endDate) {
    const cur = new Date(startDate);
    const end = new Date(endDate);
    const generated = [];

    const seasonMap = {
      12: 'Winter', 1: 'Winter', 2: 'Winter',
      3: 'Spring', 4: 'Spring', 5: 'Spring',
      6: 'Summer', 7: 'Summer', 8: 'Summer',
      9: 'Autumn', 10: 'Autumn', 11: 'Autumn'
    };

    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      if (!this.futureDatesCached.has(dStr)) {
        const month = cur.getMonth() + 1;
        const dayOfWeek = cur.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const season = seasonMap[month] || 'Winter';
        const weather = season === 'Winter'
          ? (cur.getDate() % 4 === 0 ? 'Snowy' : cur.getDate() % 3 === 0 ? 'Cloudy' : 'Sunny')
          : season === 'Summer'
            ? (cur.getDate() % 5 === 0 ? 'Rainy' : 'Sunny')
            : (cur.getDate() % 3 === 0 ? 'Rainy' : 'Sunny');

        this.baselines.forEach((b) => {
          const promo = isWeekend && cur.getDate() % 2 === 0 ? 1 : b.promotion;
          const disc = promo ? b.discount + 5 : b.discount;

          const trendFactor = season === 'Winter' ? 1.05 : season === 'Summer' ? 1.02 : 0.98;
          const spikeFactor = promo ? 1.18 : 1.0;
          const dayFactor = 1 + Math.sin(cur.getDate() * 0.4) * 0.06;
          const predictedDemand = Math.round(b.avgDemand * trendFactor * spikeFactor * dayFactor * 100) / 100;

          const rec = {
            date: dStr,
            storeId: b.storeId,
            productId: b.productId,
            category: b.category,
            region: b.region,
            inventoryLevel: b.inventoryLevel,
            unitsSold: Math.round(predictedDemand * 0.95),
            unitsOrdered: Math.round(predictedDemand * 1.05),
            price: b.price,
            discount: disc,
            weatherCondition: weather,
            promotion: promo,
            competitorPricing: b.competitorPricing,
            seasonality: season,
            epidemic: 0,
            demand: Math.max(10, predictedDemand),
            predicted_cA: Math.round(predictedDemand * 1.414 * 0.85 * 100) / 100,
            predicted_cD: Math.round(predictedDemand * 1.414 * 0.15 * 100) / 100,
            isForecast: true
          };
          generated.push(rec);
        });

        this.futureDatesCached.add(dStr);
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (generated.length > 0) {
      this.futureRecords.push(...generated);
    }
  }

  async ensureFutureRecords(startDate, endDate) {
    if (!startDate || !endDate || endDate <= this.maxDate) {
      return;
    }

    const futureStart = startDate > this.maxDate ? startDate : this.getNextDate(this.maxDate);
    const futureEnd = endDate;

    if (futureStart > futureEnd) return;

    const missingDates = [];
    const cur = new Date(futureStart);
    const end = new Date(futureEnd);

    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      if (!this.futureDatesCached.has(dStr)) {
        missingDates.push(dStr);
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (missingDates.length === 0) return;

    const fetchStart = missingDates[0];
    const fetchEnd = missingDates[missingDates.length - 1];

    try {
      const mlResult = await mlService.getForecastTimeline({
        start_date: fetchStart,
        end_date: fetchEnd
      });

      if (mlResult && Array.isArray(mlResult.records) && mlResult.records.length > 0) {
        for (const rec of mlResult.records) {
          if (!this.futureDatesCached.has(rec.date)) {
            this.futureDatesCached.add(rec.date);
          }
          this.futureRecords.push(rec);
        }
        console.log(`[DataService] ML Service generated ${mlResult.records.length} future forecast records for ${fetchStart} → ${fetchEnd}`);
      } else {
        this.generateFallbackFutureRecords(fetchStart, fetchEnd);
      }
    } catch (err) {
      console.warn(`[DataService] ML service call failed (${err.message}), applying internal baseline generator for ${fetchStart} → ${fetchEnd}`);
      this.generateFallbackFutureRecords(fetchStart, fetchEnd);
    }
  }

  getFilters() {
    return this.uniqueFilters;
  }

  async filterRecords(filters = {}) {
    const { storeId, productId, category, region, weather, seasonality, from, to } = filters;

    const isFutureQuery = (to && to > this.maxDate) || (from && from > this.maxDate);

    if (isFutureQuery) {
      const futureStart = (from && from > this.maxDate) ? from : this.getNextDate(this.maxDate);
      const futureEnd = to || '2026-01-31';
      await this.ensureFutureRecords(futureStart, futureEnd);
    }

    let recordsPool;
    if (from && from > this.maxDate) {
      recordsPool = this.futureRecords;
    } else if (to && to > this.maxDate) {
      recordsPool = this.records.concat(this.futureRecords);
    } else {
      recordsPool = this.records;
    }

    return recordsPool.filter((r) => {
      if (storeId && storeId !== 'ALL' && r.storeId !== storeId) return false;
      if (productId && productId !== 'ALL' && r.productId !== productId) return false;
      if (category && category !== 'ALL' && r.category.toLowerCase() !== category.toLowerCase()) return false;
      if (region && region !== 'ALL' && r.region.toLowerCase() !== region.toLowerCase()) return false;
      if (weather && weather !== 'ALL' && r.weatherCondition.toLowerCase() !== weather.toLowerCase()) return false;
      if (seasonality && seasonality !== 'ALL' && r.seasonality.toLowerCase() !== seasonality.toLowerCase()) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
  }

  async getKpis(filters = {}) {
    const filtered = await this.filterRecords(filters);
    const storeSet = new Set();
    const productSet = new Set();
    const dateSet = new Set();
    let totalDemand = 0;
    let forecastRecordCount = 0;

    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      totalDemand += r.demand;
      storeSet.add(r.storeId);
      productSet.add(r.productId);
      dateSet.add(r.date);
      if (r.isForecast) forecastRecordCount++;
    }

    const uniqueDays = dateSet.size || 1;
    const avgDailyDemand = filtered.length > 0 ? totalDemand / uniqueDays : 0;
    const avgDemandPerRecord = filtered.length > 0 ? totalDemand / filtered.length : 0;

    const isPureForecast = (filters.from && filters.from > this.maxDate);
    const hasForecast = forecastRecordCount > 0;

    return {
      totalDemand: Math.round(totalDemand * 100) / 100,
      avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
      avgDemandPerRecord: Math.round(avgDemandPerRecord * 100) / 100,
      storeCount: storeSet.size,
      productCount: productSet.size,
      recordCount: filtered.length,
      daysCovered: uniqueDays,
      isForecast: isPureForecast || hasForecast,
      hasForecast,
      forecastCount: forecastRecordCount
    };
  }

  async getTimeSeries(filters = {}) {
    const filtered = await this.filterRecords(filters);

    const dateMap = new Map();
    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      const cur = dateMap.get(r.date) || { demand: 0, count: 0, priceSum: 0, promoCount: 0, isForecast: false };
      cur.demand += r.demand;
      cur.count += 1;
      cur.priceSum += r.price;
      if (r.promotion > 0) cur.promoCount += 1;
      if (r.isForecast) cur.isForecast = true;
      dateMap.set(r.date, cur);
    }

    const sortedDates = Array.from(dateMap.keys()).sort();
    const series = sortedDates.map((d) => {
      const item = dateMap.get(d);
      return {
        date: d,
        demand: Math.round(item.demand * 100) / 100,
        avgPrice: Math.round((item.priceSum / (item.count || 1)) * 100) / 100,
        hasPromotion: item.promoCount > 0,
        isForecast: item.isForecast
      };
    });

    return series;
  }

  async getAggregated(groupBy = 'category', filters = {}) {
    const filtered = await this.filterRecords(filters);
    const aggMap = new Map();

    const normalizedGroupBy = groupBy.toLowerCase();

    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      let key = 'Other';
      if (normalizedGroupBy === 'category') key = r.category;
      else if (normalizedGroupBy === 'region') key = r.region;
      else if (normalizedGroupBy === 'seasonality') key = r.seasonality;
      else if (normalizedGroupBy === 'weather' || normalizedGroupBy === 'weathercondition') key = r.weatherCondition;
      else if (normalizedGroupBy === 'store' || normalizedGroupBy === 'storeid') key = r.storeId;
      else if (normalizedGroupBy === 'product' || normalizedGroupBy === 'productid') key = r.productId;

      const cur = aggMap.get(key) || { totalDemand: 0, count: 0 };
      cur.totalDemand += r.demand;
      cur.count += 1;
      aggMap.set(key, cur);
    }

    const result = Array.from(aggMap.entries()).map(([name, data]) => ({
      name,
      totalDemand: Math.round(data.totalDemand * 100) / 100,
      avgDemand: Math.round((data.totalDemand / (data.count || 1)) * 100) / 100,
      count: data.count
    }));

    result.sort((a, b) => b.totalDemand - a.totalDemand);
    return result;
  }

  async getRawData(options = {}) {
    const {
      page = 1,
      limit = 25,
      search = '',
      sortBy = 'date',
      sortOrder = 'desc',
      storeId,
      productId,
      category,
      region,
      weather,
      seasonality,
      from,
      to
    } = options;

    let filtered = await this.filterRecords({ storeId, productId, category, region, weather, seasonality, from, to });

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.storeId.toLowerCase().includes(q) ||
          r.productId.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q) ||
          r.weatherCondition.toLowerCase().includes(q) ||
          r.seasonality.toLowerCase().includes(q) ||
          r.date.includes(q)
      );
    }

    const sortField = sortBy;
    const isAsc = sortOrder.toLowerCase() === 'asc';
    filtered.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (va === undefined) va = '';
      if (vb === undefined) vb = '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return isAsc ? va - vb : vb - va;
      }
      va = String(va);
      vb = String(vb);
      return isAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    const total = filtered.length;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const totalPages = Math.ceil(total / pageSize);
    const offset = (pageNum - 1) * pageSize;
    const paginatedData = filtered.slice(offset, offset + pageSize);

    return {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages,
      data: paginatedData
    };
  }
}

module.exports = new DataService();
