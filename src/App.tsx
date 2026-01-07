import { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, Package, Info, RefreshCw, Scale, Settings } from 'lucide-react';

const App = () => {
  // --- 狀態管理 ---
  
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
  const [items, setItems] = useState([
    { id: 1, name: '手工羊毛大衣', priceKRW: 150000, quantity: 2, weight: 1.2 },
    { id: 2, name: '基本款棉T', priceKRW: 12000, quantity: 10, weight: 0.2 },
    { id: 3, name: '羅紋襪子', priceKRW: 3000, quantity: 20, weight: 0.05 },
  ]);

  // 計算結果
  const [results, setResults] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* 標題區 */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-8 h-8 text-indigo-600" />
              跨境進貨成本精算 (重量版)
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              以重量 (KG) 精準分攤運費，解決服飾輕重成本差異
            </p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
            <div className="flex flex-col">
              <label className="text-xs text-slate-400 font-medium uppercase">匯率 (KRW→TWD)</label>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-slate-400" />
                <input 
                  type="number" 
                  step="0.001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                  className="w-20 font-mono font-bold text-lg bg-transparent outline-none text-indigo-600 border-b border-dashed border-slate-300 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-400 font-medium uppercase">預期利潤 %</label>
              <div className="flex items-center gap-1">
                <input 
                  type="number" 
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(parseFloat(e.target.value) || 0)}
                  className="w-16 font-mono font-bold text-lg bg-transparent outline-none text-emerald-600 border-b border-dashed border-slate-300 focus:border-emerald-500"
                />
                <span className="text-emerald-600 font-bold">%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 左側：費率設定區 */}
          <div className="lg:col-span-3 space-y-6">
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-5 py-3 border-b border-slate-700 flex justify-between items-center">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4" /> 費率與重量設定
                </h2>
              </div>
              <div className="p-5 space-y-5">
                
                {/* 總重量設定 */}
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <label className="text-sm font-bold text-indigo-900 flex items-center gap-1 mb-1">
                    <Scale className="w-4 h-4" /> 本批總重量 (KG)
                  </label>
                  <p className="text-xs text-indigo-600 mb-2">物流公司量秤的計費重量</p>
                  <input 
                    type="number" 
                    value={totalBilledWeight}
                    onChange={(e) => setTotalBilledWeight(parseFloat(e.target.value) || 0)}
                    className="w-full text-right text-xl font-bold p-2 border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-700"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase">國際運費 (KRW/KG)</label>
                    <div className="relative mt-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="text-slate-400 text-sm">₩</span>
                      </div>
                      <input 
                        type="number" 
                        value={rates.intlRateKRW}
                        onChange={(e) => handleRateChange('intlRateKRW', e.target.value)}
                        className="w-full text-right p-2 pl-8 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase">關稅&國內運 (TWD/KG)</label>
                    <div className="relative mt-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="text-slate-400 text-sm">$</span>
                      </div>
                      <input 
                        type="number" 
                        value={rates.taxDomesticRateTWD}
                        onChange={(e) => handleRateChange('taxDomesticRateTWD', e.target.value)}
                        className="w-full text-right p-2 pl-8 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase">箱子費用 (KRW/箱)</label>
                    <div className="relative mt-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="text-slate-400 text-sm">₩</span>
                      </div>
                      <input 
                        type="number" 
                        value={rates.boxCostKRW}
                        onChange={(e) => handleRateChange('boxCostKRW', e.target.value)}
                        className="w-full text-right p-2 pl-8 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="text-[10px] text-right text-slate-400 mt-1">
                      ≈ TWD {fmt(rates.boxCostKRW * exchangeRate)}
                    </div>
                  </div>
                </div>

                {/* 總結區塊 */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                   <div className="flex justify-between text-sm">
                    <span className="text-slate-500">國際運費總額</span>
                    <span className="font-medium">${fmt(totals.totalIntlShipTWD)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">關稅國內運總額</span>
                    <span className="font-medium">${fmt(totals.totalTaxDomTWD)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">韓國費用(3%)</span>
                    <span className="font-medium">${fmt(totals.totalHandlingFeeTWD)}</span>
                  </div>
                   <div className="flex justify-between text-sm">
                    <span className="text-slate-500">箱子費總額</span>
                    <span className="font-medium">${fmt(totals.totalBoxTWD)}</span>
                  </div>
                  <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-end">
                    <span className="text-xs font-bold text-slate-700">總雜支成本</span>
                    <span className="text-lg font-bold text-indigo-600">
                      ${fmt(totals.totalIntlShipTWD + totals.totalTaxDomTWD + totals.totalBoxTWD + totals.totalHandlingFeeTWD)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右側：商品清單 */}
          <div className="lg:col-span-9 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
              <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <div className="flex items-center gap-4">
                  <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> 詳細計算
                  </h2>
                  <div className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded border border-amber-200">
                    目前商品總重: <strong>{totals.totalItemWeight?.toFixed(2)} kg</strong> 
                    {Math.abs(totals.totalItemWeight - totalBilledWeight) > 0.5 && (
                      <span className="ml-1 opacity-75">(與計費重量差 {Math.abs(totals.totalItemWeight - totalBilledWeight).toFixed(2)} kg)</span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={addItem}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> 新增商品
                </button>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-2 py-3 font-medium w-8"></th>
                      <th className="px-2 py-3 font-medium min-w-[120px]">商品名稱</th>
                      <th className="px-2 py-3 font-medium text-right w-20">單重(kg)</th>
                      <th className="px-2 py-3 font-medium text-right w-24">韓幣單價</th>
                      <th className="px-2 py-3 font-medium text-right w-16">數量</th>
                      <th className="px-2 py-3 font-medium text-right text-slate-400 w-20 hidden xl:table-cell">3%費用</th>
                      <th className="px-2 py-3 font-medium text-right text-slate-400 w-20 hidden xl:table-cell">運費分攤</th>
                      <th className="px-2 py-3 font-medium text-right bg-orange-50/50 text-orange-700 w-24 border-l border-slate-100">
                        實際成本
                      </th>
                      <th className="px-2 py-3 font-medium text-right bg-emerald-50/50 text-emerald-700 w-24">
                        建議售價
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-2 py-3 text-center">
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-2 py-3">
                          <input 
                            type="text" 
                            value={item.name}
                            placeholder="品名"
                            onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 outline-none py-1"
                          />
                        </td>
                        <td className="px-2 py-3 text-right">
                          <input 
                            type="number" 
                            step="0.1"
                            value={item.weight || ''}
                            onChange={(e) => handleItemChange(item.id, 'weight', e.target.value)}
                            className="w-full text-right bg-indigo-50/50 border-b border-transparent focus:border-indigo-500 outline-none py-1 font-mono text-indigo-600 rounded px-1"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-3 text-right">
                          <input 
                            type="number" 
                            value={item.priceKRW || ''}
                            onChange={(e) => handleItemChange(item.id, 'priceKRW', e.target.value)}
                            className="w-full text-right bg-transparent border-b border-transparent focus:border-indigo-500 outline-none py-1 font-mono text-slate-600"
                          />
                        </td>
                        <td className="px-2 py-3 text-right">
                          <input 
                            type="number" 
                            value={item.quantity || ''}
                            onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                            className="w-full text-right bg-transparent border-b border-transparent focus:border-indigo-500 outline-none py-1 font-mono text-slate-600"
                          />
                        </td>
                        
                        {/* 詳細分拆 (大螢幕顯示) */}
                        <td className="px-2 py-3 text-right text-xs text-slate-400 hidden xl:table-cell">
                          ${fmt(item.handlingFee)}
                        </td>
                        <td className="px-2 py-3 text-right text-xs text-slate-400 hidden xl:table-cell">
                          ${fmt(item.unitIntlShip + item.unitTaxDom + item.unitBox)}
                        </td>

                        <td className="px-2 py-3 text-right font-bold text-orange-600 bg-orange-50/30 border-l border-slate-100">
                          ${fmt(item.finalUnitCost)}
                        </td>
                        <td className="px-2 py-3 text-right font-bold text-emerald-600 bg-emerald-50/30">
                          ${fmt(item.suggestedPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>計算邏輯說明 (重量權重)：</strong><br/>
                    1. <strong>運費計算</strong>：依據左側設定的 KG 單價 × 總計費重量，算出這整箱要付多少錢。<br/>
                    2. <strong>運費分攤</strong>：系統依據每一行商品的 <code>單重 × 數量</code> 計算重量佔比。如果你有填寫單重，大衣分攤的運費就會比襪子多；如果沒填單重，則依數量平均分攤。<br/>
                    3. <strong>韓國費用</strong>：維持商品金額 3%。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;