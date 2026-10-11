const fs = require('fs');
const csv = require('csv-parser');
const config = require('../config');

class DataService {
  constructor() {
    this.records = [];
    this.isLoaded = false;
    this.uniqueFilters = null;
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
          // Normalize and cast fields
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
            demand: parseFloat(data.Demand || 0)
          };
          results.push(record);
        })
        .on('end', () => {
          this.records = results;
          this.isLoaded = true;
          this.buildFilterIndex();
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

    this.uniqueFilters = {
      stores: Array.from(stores).sort(),
      products: Array.from(products).sort(),
      categories: Array.from(categories).sort(),
      regions: Array.from(regions).sort(),
      weathers: Array.from(weathers).sort(),
      seasonalities: Array.from(seasonalities).sort(),
      minDate,
      maxDate
    };
  }

  getFilters() {
    return this.uniqueFilters;
  }

  filterRecords(filters = {}) {
    const { storeId, productId, category, region, weather, seasonality, from, to } = filters;

    return this.records.filter((r) => {
      if (storeId && storeId !== 'ALL' && r.storeId !== storeId) return false;
      if (productId && productId !== 'ALL' && r.productId !== productId) return false;
      if (category && category !== 'ALL' && r.category !== category) return false;
      if (region && region !== 'ALL' && r.region !== region) return false;
      if (weather && weather !== 'ALL' && r.weatherCondition !== weather) return false;
      if (seasonality && seasonality !== 'ALL' && r.seasonality !== seasonality) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
  }

  getKpis(filters = {}) {
    const filtered = this.filterRecords(filters);
    const storeSet = new Set();
    const productSet = new Set();
    const dateSet = new Set();
    let totalDemand = 0;

    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      totalDemand += r.demand;
      storeSet.add(r.storeId);
      productSet.add(r.productId);
      dateSet.add(r.date);
    }

    const uniqueDays = dateSet.size || 1;
    const avgDailyDemand = filtered.length > 0 ? totalDemand / uniqueDays : 0;
    const avgDemandPerRecord = filtered.length > 0 ? totalDemand / filtered.length : 0;

    return {
      totalDemand: Math.round(totalDemand * 100) / 100,
      avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
      avgDemandPerRecord: Math.round(avgDemandPerRecord * 100) / 100,
      storeCount: storeSet.size,
      productCount: productSet.size,
      recordCount: filtered.length,
      daysCovered: uniqueDays
    };
  }

  getTimeSeries(filters = {}) {
    const filtered = this.filterRecords(filters);

    // Group demand by date
    const dateMap = new Map();
    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      const cur = dateMap.get(r.date) || { demand: 0, count: 0, priceSum: 0, promoCount: 0 };
      cur.demand += r.demand;
      cur.count += 1;
      cur.priceSum += r.price;
      if (r.promotion > 0) cur.promoCount += 1;
      dateMap.set(r.date, cur);
    }

    // Sort by date ascending
    const sortedDates = Array.from(dateMap.keys()).sort();
    const series = sortedDates.map((d) => {
      const item = dateMap.get(d);
      return {
        date: d,
        demand: Math.round(item.demand * 100) / 100,
        avgPrice: Math.round((item.priceSum / item.count) * 100) / 100,
        hasPromotion: item.promoCount > 0
      };
    });

    return series;
  }

  getAggregated(groupBy = 'category', filters = {}) {
    const filtered = this.filterRecords(filters);
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

  getRawData(options = {}) {
    const {
      page = 1,
      limit = 25,
      search = '',
      sortBy = 'date',
      sortOrder = 'desc',
      storeId,
      productId,
      category,
      region
    } = options;

    let filtered = this.filterRecords({ storeId, productId, category, region });

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

    // Sort
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
