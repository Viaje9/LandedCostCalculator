import { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, Package, Info, RefreshCw, Scale, Settings, ChevronDown, TrendingUp, Layers } from 'lucide-react';

const App = () => {
  // --- 狀態管理 ---

  // UI 狀態
  const [settingsPanelOpen, setSettingsPanelOpen] = useState<boolean>(true);
  const [itemDetailOpen, setItemDetailOpen] = useState<{[key: number]: boolean}>({});
  const [isInitialized, setIsInitialized] = useState<boolean>(false); // 追蹤是否已初始化

  // 全局設定
  const [exchangeRate, setExchangeRate] = useState<number>(0.024); // 韓幣匯率
  const [profitMargin, setProfitMargin] = useState<number>(30); // 預期利潤 %
  
  // 新增：本批次總重量 (KG) - 用於計算總運費
  const [totalBilledWeight, setTotalBilledWeight] = useState<number>(10); 

  // 費率設定 (Rates)
  const [rates, setRates] = useState({
    intlRateKRW: 2500,     // 國際運費 (韓幣/KG)
    taxDomesticRateTWD: 200, // 關稅&國內運 (台幣/KG)
    boxCostKRW: 3000,      // 箱子費用 (固定韓幣/箱)
  });

  // 商品列表 (新增 weight 欄位)
  interface Item {
    id: number;
    name: string;
    priceKRW: number;
    quantity: number;
    weight: number;
  }
  const [items, setItems] = useState<Item[]>([]);

  // 計算結果
  const [results, setResults] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});

  // --- localStorage 初始化：載入資料 ---
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('costCalculatorData');
      if (savedData) {
        const data = JSON.parse(savedData);
        if (data.exchangeRate !== undefined) setExchangeRate(data.exchangeRate);
        if (data.profitMargin !== undefined) setProfitMargin(data.profitMargin);
        if (data.totalBilledWeight !== undefined) setTotalBilledWeight(data.totalBilledWeight);
        if (data.rates) setRates(data.rates);
        if (data.items) setItems(data.items);
      }
    } catch (error) {
      console.error('Failed to load data from localStorage:', error);
    }
    // 標記初始化完成
    setIsInitialized(true);
  }, []); // 只在初始化時執行一次

  // --- 計算核心邏輯 ---
  useEffect(() => {
    // 1. 基礎加總
    const totalKRW = items.reduce((sum, item) => sum + (item.priceKRW * item.quantity), 0);
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    
    // 計算商品輸入的總重量 (用於檢查是否跟總重量有落差，並計算佔比)
    const totalItemWeight = items.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
    // 如果商品沒填重量(為0)，為了避免分母為0，使用數量做為權重備案
    const useWeightForAllocation = totalItemWeight > 0;

    // 2. 計算總成本 (根據總重量 Total Billed Weight 計算要付給貨運行的錢)
    // A. 國際運費 (韓幣/KG * 總KG * 匯率)
    const totalIntlShipTWD = (rates.intlRateKRW * totalBilledWeight) * exchangeRate;
    
    // B. 關稅 & 國內運 (台幣/KG * 總KG)
    const totalTaxDomTWD = rates.taxDomesticRateTWD * totalBilledWeight;
    
    // C. 箱子費用 (韓幣 * 匯率)
    const totalBoxTWD = rates.boxCostKRW * exchangeRate;

    // D. 韓國 3% 費用總額 (總韓幣 * 3% * 匯率)
    const totalHandlingFeeTWD = (totalKRW * exchangeRate) * 0.03;

    // 3. 逐項計算分攤
    const calculatedItems = items.map(item => {
      // A. 商品本體 (台幣)
      const baseCostTWD = item.priceKRW * exchangeRate;
      
      // B. 韓國 3% 費用 (按金額計算：商品價錢 * 3%)
      const handlingFee = baseCostTWD * 0.03;
      
      // 計算分攤權重
      // 如果有填重量，就用 (單件重量 * 數量) / 總商品重量
      // 如果沒填重量，就用 (數量) / 總數量
      let allocationRatio = 0;
      if (useWeightForAllocation) {
        allocationRatio = (item.weight * item.quantity) / totalItemWeight;
      } else {
        allocationRatio = totalQty > 0 ? item.quantity / totalQty : 0;
      }
      
      // 算出「這一整行商品(Batch)」分攤到的總運費
      // 這裡使用 allocationRatio 把整箱的運費分給這一行
      const batchIntlShip = totalIntlShipTWD * allocationRatio;
      const batchTaxDom = totalTaxDomTWD * allocationRatio;
      
      // 箱子費通常按體積/件數分攤比較合理，但為了簡化，這裡統一跟著運費邏輯(重量)走，
      // 或者你可以改成 totalBoxTWD * (item.quantity / totalQty) 按件數分攤。
      // 這裡示範按件數分攤箱子(比較符合物理邏輯，襪子也要佔空間)
      const batchBox = totalQty > 0 ? totalBoxTWD * (item.quantity / totalQty) : 0;

      // 除以數量，變回「單件」的分攤成本
      const unitIntlShip = item.quantity > 0 ? batchIntlShip / item.quantity : 0;
      const unitTaxDom = item.quantity > 0 ? batchTaxDom / item.quantity : 0;
      const unitBox = item.quantity > 0 ? batchBox / item.quantity : 0;

      // 單件總成本
      const finalUnitCost = baseCostTWD + handlingFee + unitIntlShip + unitTaxDom + unitBox;

      // 建議售價
      const suggestedPrice = finalUnitCost * (1 + profitMargin / 100);

      return {
        ...item,
        baseCostTWD,
        handlingFee,
        unitIntlShip,
        unitTaxDom,
        unitBox,
        finalUnitCost,
        suggestedPrice,
        totalCostBatch: finalUnitCost * item.quantity
      };
    });

    const grandTotalCost = calculatedItems.reduce((sum, item) => sum + item.totalCostBatch, 0);

    setResults(calculatedItems);
    setTotals({
      totalKRW,
      totalQty,
      grandTotalCost,
      totalIntlShipTWD,
      totalTaxDomTWD,
      totalBoxTWD,
      totalHandlingFeeTWD,
      totalItemWeight, // 統計出的商品總重
    });

  }, [items, rates, totalBilledWeight, exchangeRate, profitMargin]);

  // --- localStorage 自動儲存：監聽資料變化並儲存 ---
  useEffect(() => {
    // 只有在初始化完成後才儲存，避免用預設值覆蓋 localStorage
    if (!isInitialized) return;

    try {
      const dataToSave = {
        exchangeRate,
        profitMargin,
        totalBilledWeight,
        rates,
        items,
      };
      localStorage.setItem('costCalculatorData', JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Failed to save data to localStorage:', error);
    }
  }, [exchangeRate, profitMargin, totalBilledWeight, rates, items, isInitialized]); // 當任一狀態改變時自動儲存

  // --- 事件處理 ---
  const handleRateChange = (field: string, value: string) => {
    const numVal = parseFloat(value) || 0;
    setRates(prev => ({ ...prev, [field]: numVal }));
  };

  const handleItemChange = (id: number, field: string, value: string) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: field === 'name' ? value : parseFloat(value) || 0 };
      }
      return item;
    });
    setItems(newItems);
  };

  const addItem = () => {
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    setItems([...items, { id: newId, name: '', priceKRW: 0, quantity: 1, weight: 0.5 }]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  // 格式化金錢
  const fmt = (num: number) => Math.round(num).toLocaleString();

  // 切換商品詳細資訊
  const toggleItemDetail = (id: number) => {
    setItemDetailOpen(prev => ({...prev, [id]: !prev[id]}));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 text-slate-800 relative">
      {/* 背景裝飾 - 簡約版 */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 -right-40 w-96 h-96 bg-emerald-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 -left-40 w-96 h-96 bg-green-300 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-md mx-auto p-4 space-y-4">

        {/* 標題區 - 清新設計 */}
        <div className="text-center py-6 relative">
          <div className="relative space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Layers className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
              跨境成本精算
            </h1>
            <p className="text-slate-600 text-sm font-light">
              重量權重 · 精準分攤 · 利潤優化
            </p>
          </div>
        </div>

        {/* 快速設定卡片 - 匯率與利潤 */}
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg shadow-emerald-100/50 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-50 to-transparent px-5 py-4 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-800">快速設定</h2>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-600 uppercase tracking-wide font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> 匯率
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-lg font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">KRW</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-600 uppercase tracking-wide font-medium">利潤率</label>
                <div className="relative">
                  <input
                    type="number"
                    value={profitMargin}
                    onChange={(e) => setProfitMargin(parseFloat(e.target.value) || 0)}
                    className="w-full bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-2.5 text-lg font-mono font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-emerald-600 font-bold">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 費率與重量設定 - 可折疊 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <button
            onClick={() => setSettingsPanelOpen(!settingsPanelOpen)}
            className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-slate-50 to-transparent hover:from-slate-100 transition-all"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-600" />
              <h2 className="font-semibold text-slate-800">費率與重量設定</h2>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${settingsPanelOpen ? 'rotate-180' : ''}`} />
          </button>

          <div className={`overflow-hidden transition-all duration-300 ${settingsPanelOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="p-5 space-y-5 border-t border-slate-200">

              {/* 總重量設定 */}
              <div className="relative bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-xl border border-emerald-200 overflow-hidden">
                <label className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-2">
                  <Scale className="w-4 h-4" /> 本批總重量 (KG)
                </label>
                <p className="text-xs text-emerald-600 mb-3">物流公司量秤的計費重量</p>
                <input
                  type="number"
                  value={totalBilledWeight}
                  onChange={(e) => setTotalBilledWeight(parseFloat(e.target.value) || 0)}
                  className="w-full text-center text-3xl font-mono font-black p-3 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-700 transition-all"
                />
              </div>

              {/* 費率輸入 */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-600 uppercase tracking-wide font-medium block mb-2">
                    國際運費 (KRW/KG)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₩</span>
                    <input
                      type="number"
                      value={rates.intlRateKRW}
                      onChange={(e) => handleRateChange('intlRateKRW', e.target.value)}
                      className="w-full text-right pr-3 pl-8 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 font-mono transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 uppercase tracking-wide font-medium block mb-2">
                    關稅&國內運 (TWD/KG)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      value={rates.taxDomesticRateTWD}
                      onChange={(e) => handleRateChange('taxDomesticRateTWD', e.target.value)}
                      className="w-full text-right pr-3 pl-8 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 font-mono transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 uppercase tracking-wide font-medium block mb-2">
                    箱子費用 (KRW/箱)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₩</span>
                    <input
                      type="number"
                      value={rates.boxCostKRW}
                      onChange={(e) => handleRateChange('boxCostKRW', e.target.value)}
                      className="w-full text-right pr-3 pl-8 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 font-mono transition-all"
                    />
                  </div>
                  <div className="text-[10px] text-right text-slate-400 mt-1">
                    ≈ TWD {fmt(rates.boxCostKRW * exchangeRate)}
                  </div>
                </div>
              </div>

              {/* 總結區塊 */}
              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">國際運費總額</span>
                  <span className="font-mono text-slate-700">${fmt(totals.totalIntlShipTWD)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">關稅國內運總額</span>
                  <span className="font-mono text-slate-700">${fmt(totals.totalTaxDomTWD)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">韓國費用(3%)</span>
                  <span className="font-mono text-slate-700">${fmt(totals.totalHandlingFeeTWD)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">箱子費總額</span>
                  <span className="font-mono text-slate-700">${fmt(totals.totalBoxTWD)}</span>
                </div>
                <div className="pt-3 border-t border-emerald-200 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-transparent p-3 rounded-lg -mx-1">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">總雜支成本</span>
                  <span className="text-2xl font-black font-mono text-emerald-600">
                    ${fmt(totals.totalIntlShipTWD + totals.totalTaxDomTWD + totals.totalBoxTWD + totals.totalHandlingFeeTWD)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 商品清單統計橫幅 */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-200 p-4 flex items-center justify-between shadow-md">
          <div>
            <div className="text-xs text-slate-600 uppercase tracking-wide mb-1">目前商品總重</div>
            <div className="text-2xl font-black font-mono text-emerald-700">
              {totals.totalItemWeight?.toFixed(2)} <span className="text-sm text-slate-500">kg</span>
            </div>
            {Math.abs(totals.totalItemWeight - totalBilledWeight) > 0.5 && (
              <div className="text-[10px] text-emerald-600 mt-1">
                與計費重量差 {Math.abs(totals.totalItemWeight - totalBilledWeight).toFixed(2)} kg
              </div>
            )}
          </div>
          <button
            onClick={addItem}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/30 active:scale-95"
          >
            <Plus className="w-4 h-4" /> 新增商品
          </button>
        </div>

        {/* 商品列表 - 卡片式設計 */}
        <div className="space-y-3">
          {results.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden group hover:border-emerald-300 hover:shadow-lg transition-all"
            >
              {/* 商品主要資訊 */}
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="mt-1 text-slate-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={item.name}
                      placeholder="輸入商品名稱..."
                      onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    />

                    {/* 輸入欄位網格 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-600 uppercase block mb-1">單重(kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={item.weight || ''}
                          onChange={(e) => handleItemChange(item.id, 'weight', e.target.value)}
                          className="w-full bg-emerald-50 border border-emerald-300 rounded-lg px-2 py-1.5 text-center text-emerald-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 uppercase block mb-1">韓幣單價</label>
                        <input
                          type="number"
                          value={item.priceKRW || ''}
                          onChange={(e) => handleItemChange(item.id, 'priceKRW', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-center text-slate-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 uppercase block mb-1">數量</label>
                        <input
                          type="number"
                          value={item.quantity || ''}
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-center text-slate-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 結果顯示 */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 p-3 rounded-xl border border-orange-200">
                    <div className="text-[10px] text-orange-600 uppercase tracking-wide mb-1">實際成本</div>
                    <div className="text-xl font-black font-mono text-orange-700">
                      ${fmt(item.finalUnitCost)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-3 rounded-xl border border-emerald-200">
                    <div className="text-[10px] text-emerald-600 uppercase tracking-wide mb-1">建議售價</div>
                    <div className="text-xl font-black font-mono text-emerald-700">
                      ${fmt(item.suggestedPrice)}
                    </div>
                  </div>
                </div>

                {/* 詳細分析 - 可折疊 */}
                <button
                  onClick={() => toggleItemDetail(item.id)}
                  className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-emerald-600 transition-colors py-2"
                >
                  <span className="flex items-center gap-1">
                    <Calculator className="w-3 h-3" />
                    詳細成本拆解
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${itemDetailOpen[item.id] ? 'rotate-180' : ''}`} />
                </button>

                {itemDetailOpen[item.id] && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 text-xs animate-in fade-in duration-200">
                    <div className="flex justify-between">
                      <span className="text-slate-600">商品本體 (TWD)</span>
                      <span className="font-mono text-slate-700">${fmt(item.baseCostTWD)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">韓國費用 (3%)</span>
                      <span className="font-mono text-slate-700">${fmt(item.handlingFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">國際運費分攤</span>
                      <span className="font-mono text-slate-700">${fmt(item.unitIntlShip)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">關稅&國內運分攤</span>
                      <span className="font-mono text-slate-700">${fmt(item.unitTaxDom)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">箱子費用分攤</span>
                      <span className="font-mono text-slate-700">${fmt(item.unitBox)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-emerald-200">
                      <span className="text-slate-700 font-semibold">批次總成本</span>
                      <span className="font-mono text-emerald-700 font-bold">${fmt(item.totalCostBatch)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 說明區塊 */}
        <div className="bg-gradient-to-br from-emerald-50/50 to-green-50/50 rounded-2xl border border-emerald-200 p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
              <p className="text-emerald-700 font-semibold">計算邏輯說明 (重量權重)</p>
              <p><span className="text-slate-800 font-medium">運費計算：</span>依據設定的 KG 單價 × 總計費重量。</p>
              <p><span className="text-slate-800 font-medium">運費分攤：</span>依據 單重 × 數量 計算重量佔比。重物分攤較多運費。</p>
              <p><span className="text-slate-800 font-medium">韓國費用：</span>維持商品金額 3%。</p>
            </div>
          </div>
        </div>

        {/* 底部間距 */}
        <div className="h-8"></div>
      </div>
    </div>
  );
};

export default App;