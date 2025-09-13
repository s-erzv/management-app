import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, TrendingUp, Package, History, BarChart as BarIcon, ArrowUpDown, FileDown } from "lucide-react";
import { toast } from "react-hot-toast";
import ProductStockTable from '@/components/reports/ProductStockTable';
import DemandReportTable from '@/components/reports/DemandReportTable';
import StockReconciliationHistoryTable from '@/components/reports/StockReconciliationHistoryTable';

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

const ReportsPage = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    products: [],
    productChartData: [],
    galonChartData: [],
    demand: [],
    diff: [],
    reconciliations: [],
  });
  
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState('all');

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      handleResize(); // Set initial value
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  useEffect(() => {
    if (companyId) {
      fetchCategories();
      fetchAllReportsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedCategoryId, selectedSubCategoryId]);

  const fetchCategories = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('categories')
      .select('*, subcategories(*)');
    if (error) {
      console.error('Error fetching categories:', error);
      toast.error('Gagal memuat kategori.');
    } else {
      setCategories(data || []);
      const selectedCategory = data?.find((c) => String(c.id) === String(selectedCategoryId));
      setSubCategories(selectedCategory ? (selectedCategory.subcategories || []) : []);
    }
  };

  const fetchAllReportsData = async () => {
    setLoading(true);
    if (!companyId) return;

    try {
      let productsQuery = supabase
        .from("products")
        .select("id, name, stock, empty_bottle_stock, is_returnable, sort_order")
        .eq("company_id", companyId)
        .order('sort_order', { ascending: true });

      if (selectedCategoryId !== 'all') {
        productsQuery = productsQuery.eq('category_id', selectedCategoryId);
      }
      if (selectedSubCategoryId !== 'all') {
        productsQuery = productsQuery.eq('subcategory_id', selectedSubCategoryId);
      }

      const { data: productsData, error: productError } = await productsQuery;
      if (productError) throw productError;
      const safeProducts = (productsData || []).map(p => ({ ...p, stock: Number(p.stock) || 0, empty_bottle_stock: Number(p.empty_bottle_stock) || 0 }));

      const productIds = safeProducts.map(p => p.id);

      const { data: reconciliationsData, error: reconciliationsError } = await supabase
        .from('stock_reconciliations')
        .select(`*, user:user_id(full_name)`)
        .eq('company_id', companyId)
        .order('reconciliation_date', { ascending: false });
      if (reconciliationsError) throw reconciliationsError;

      const { data: filteredOrders, error: orderError } = await supabase
        .from("orders")
        .select("id")
        .eq("company_id", companyId)
        .in("status", ["draft", "sent"]);
      if (orderError) throw orderError;

      const filteredOrderIds = (filteredOrders || []).map((order) => order.id);

      let demandItems = [];
      let galonDemands = [];
      let galonSupplies = [];

      if (filteredOrderIds.length > 0 && productIds.length > 0) {
        const { data: items, error: demandItemsError } = await supabase
          .from("order_items")
          .select(`product_id, qty`)
          .in("order_id", filteredOrderIds)
          .in("product_id", productIds);
        if (demandItemsError) throw demandItemsError;
        demandItems = items || [];

        const { data: galonItems, error: galonItemsError } = await supabase
          .from("order_galon_items")
          .select(`product_id, returned_qty, purchased_empty_qty`)
          .in("order_id", filteredOrderIds)
          .in("product_id", productIds);
        if (galonItemsError) throw galonItemsError;
        galonDemands = galonItems.map(item => ({ product_id: item.product_id, qty: Number(item.purchased_empty_qty) || 0 }));
        galonSupplies = galonItems.map(item => ({ product_id: item.product_id, qty: Number(item.returned_qty) || 0 }));
      }

      const demandByProduct = (demandItems || []).reduce((acc, item) => {
        const qty = Number(item.qty) || 0;
        acc[item.product_id] = (acc[item.product_id] || 0) + qty;
        return acc;
      }, {});
      
      const demandByEmptyBottle = (galonDemands || []).reduce((acc, item) => {
        const qty = Number(item.qty) || 0;
        acc[item.product_id] = (acc[item.product_id] || 0) + qty;
        return acc;
      }, {});

      const supplyByEmptyBottle = (galonSupplies || []).reduce((acc, item) => {
        const qty = Number(item.qty) || 0;
        acc[item.product_id] = (acc[item.product_id] || 0) + qty;
        return acc;
      }, {});
      
      // Data for the main products chart (all products)
      const allProductsData = safeProducts.map((p) => {
        return {
          id: p.id,
          name: p.name,
          stock: p.stock,
          demand: (demandByProduct[p.id] || 0),
          diff: p.stock - (demandByProduct[p.id] || 0),
          type: p.is_returnable ? 'Galon' : 'Non-Galon',
        };
      });

      // Data for the specific empty bottle chart (only returnable products)
      const galonChartData = safeProducts.filter(p => p.is_returnable).map((p) => {
        return {
          id: p.id,
          name: p.name,
          stock: p.empty_bottle_stock,
          demand: (demandByEmptyBottle[p.id] || 0),
          diff: p.empty_bottle_stock - (demandByEmptyBottle[p.id] || 0),
          type: 'Kemasan Returnable',
        };
      });

      const demandTableData = safeProducts.map((p) => ({
        name: p.name,
        demand: p.is_returnable ? (demandByEmptyBottle[p.id] || 0) : (demandByProduct[p.id] || 0),
      }));

      const diffTableData = allProductsData
        .map(({ name, stock, demand, diff, type }) => ({ name, stock, demand, diff, type }))
        .sort((a, b) => a.diff - b.diff);

      setReportData({
        products: safeProducts,
        productChartData: allProductsData,
        galonChartData,
        demand: demandTableData,
        diff: diffTableData,
        reconciliations: reconciliationsData || [],
      });

    } catch (error) {
      console.error('Error fetching all reports data:', error);
      toast.error('Gagal memuat data laporan.');
      setReportData({
        products: [],
        productChartData: [],
        galonChartData: [],
        demand: [],
        diff: [],
        reconciliations: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (value) => {
    setSelectedCategoryId(value);
    const selectedCategory = categories.find(cat => String(cat.id) === String(value));
    setSubCategories(selectedCategory ? (selectedCategory.subcategories || []) : []);
    setSelectedSubCategoryId('all');
  };

  const handleSubCategoryChange = (value) => {
    setSelectedSubCategoryId(value);
  };

  const formatTick = (val = '') => {
    const s = String(val);
    return s.length > 18 ? `${s.slice(0, 18)}…` : s;
  };
  
  const handleExportToCsv = () => {
    if (!reportData.diff || reportData.diff.length === 0) {
      toast.error("Tidak ada data untuk diekspor.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const filename = `laporan_stok_permintaan_${today}.csv`;
    
    let csvContent = "Produk,Jenis Stok,Stok,Permintaan,Selisih\n";
    
    reportData.diff.forEach(row => {
      csvContent += `${row.name},${row.type},${row.stock},${row.demand},${row.diff}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Data berhasil diekspor!");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#10182b]" />
      </div>
    );
  }

  const chartHeight = Math.max(300, reportData.productChartData.length * 25);
  const galonChartHeight = Math.max(300, reportData.galonChartData.length * 25);

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
          <BarIcon className="h-8 w-8" />
          Laporan & Analisis
        </h1>
        <Button 
          variant="outline"
          onClick={handleExportToCsv}
          className="text-[#10182b] hover:bg-gray-100"
          disabled={loading || reportData.diff.length === 0}
        >
          <FileDown className="mr-2 h-4 w-4" /> Export Excel
        </Button>
      </div>

      {/* FILTER SECTIONS */}
      <Card className="border-0 shadow-lg bg-white">
        <CardHeader className="bg-gray-50 rounded-t-lg">
          <CardTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="h-6 w-6" /> Filter Laporan
          </CardTitle>
          <CardDescription>
            Pilih kategori atau subkategori untuk menyaring laporan.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-2">
              <Label htmlFor="category-filter">Filter Kategori</Label>
              <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcategory-filter">Filter Subkategori</Label>
              <Select value={selectedSubCategoryId} onValueChange={handleSubCategoryChange} disabled={selectedCategoryId === 'all'}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Semua Subkategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Subkategori</SelectItem>
                  {subCategories.map((sub) => (
                    <SelectItem key={sub.id} value={String(sub.id)}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* GRAFIK 1: Stok Produk Non-Galon vs Permintaan */}
      <Card className="border-0 shadow-lg bg-white">
        <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
          <CardTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="h-6 w-6" /> Stok Produk (Semua) vs Permintaan
          </CardTitle>
          <CardDescription className="text-gray-200">
            Perbandingan visual stok produk yang tersedia dengan total permintaan dari pesanan aktif, untuk semua produk.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {reportData.productChartData && reportData.productChartData.length > 0 ? (
            <div className="border rounded-lg p-2">
              <ResponsiveContainer width="100%" height={chartHeight} className='p-1'>
                <ComposedChart
                  data={reportData.productChartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    height={120}
                    interval={0}
                    angle={-90}
                    textAnchor="end"
                    tickMargin={12}
                    tickFormatter={formatTick}
                    style={{ fontSize: isMobile ? '8px' : '10px' }}
                    minTickGap={0}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Legend verticalAlign="top" align="right" height={36} />
                  <Line type="monotone" dataKey="stock" name="Stok" stroke="#10182b" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="demand" name="Permintaan" stroke="#ff6b6b" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex justify-center items-center h-40">
              <p className="text-muted-foreground">Tidak ada data untuk grafik produk.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg bg-white">
        <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
          <CardTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="h-6 w-6" /> Stok produk returnable
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {reportData.galonChartData && reportData.galonChartData.length > 0 ? (
            <div className="border rounded-lg p-2">
              <ResponsiveContainer width="100%" height={galonChartHeight} className='p-1'>
                <ComposedChart
                  data={reportData.galonChartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    height={120}
                    interval={0}
                    angle={-90}
                    textAnchor="end"
                    tickMargin={12}
                    tickFormatter={formatTick}
                    style={{ fontSize: isMobile ? '8px' : '10px' }}
                    minTickGap={0}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Legend verticalAlign="top" align="right" height={36} />
                  <Line type="monotone" dataKey="stock" name="Stok product returnable kosong" stroke="#10182b" strokeWidth={2} dot={{ r: 2 }} />
                  {/* <Line type="monotone" dataKey="demand" name="Permintaan" stroke="#ff6b6b" strokeWidth={2} dot={{ r: 2 }} /> */}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex justify-center items-center h-40">
              <p className="text-muted-foreground">Tidak ada data untuk grafik Kemasan Returnable.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DETAIL TABEL KOMPREHENSIF HORIZONTAL */}
      <Card className="border-0 shadow-lg bg-white">
        <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-t-lg border-b">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Package className="h-6 w-6" /> Detail Stok & Permintaan
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto whitespace-nowrap">
            <table className="w-full min-w-full text-sm border-collapse rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 border-b border-r sticky left-0 bg-gray-50">Produk</th>
                  {reportData.diff.map(product => (
                    <th key={product.name} className="text-center p-3 border-b border-r">{product.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50">
                  <th className="text-left p-3 border-b border-r sticky left-0 bg-gray-50 font-normal">Tipe Stok</th>
                  {reportData.diff.map(product => (
                    <td key={product.name} className="p-3 border-b border-r text-center">{product.type}</td>
                  ))}
                </tr>
                <tr className="hover:bg-gray-50">
                  <th className="text-left p-3 border-b border-r sticky left-0 bg-gray-50 font-normal">Stok</th>
                  {reportData.diff.map(product => (
                    <td key={product.name} className="p-3 border-b border-r text-center">{product.stock}</td>
                  ))}
                </tr>
                <tr className="hover:bg-gray-50">
                  <th className="text-left p-3 border-b border-r sticky left-0 bg-gray-50 font-normal">Permintaan</th>
                  {reportData.diff.map(product => (
                    <td key={product.name} className="p-3 border-b border-r text-center">{product.demand}</td>
                  ))}
                </tr>
                <tr className="hover:bg-gray-50">
                  <th className="text-left p-3 border-b border-r sticky left-0 bg-gray-50 font-normal">Selisih</th>
                  {reportData.diff.map(product => (
                    <td
                      key={product.name}
                      className={`p-3 border-b border-r text-center font-medium ${product.diff < 0 ? 'text-red-600' : product.diff === 0 ? 'text-amber-600' : 'text-emerald-700'}`}
                    >
                      {product.diff}
                    </td>
                  ))}
                </tr>
                {reportData.diff.length === 0 && (
                  <tr>
                    <td colSpan={reportData.diff.length + 1} className="p-4 text-center text-muted-foreground">Belum ada data.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="text-xs text-muted-foreground mt-2">* Baris dengan nilai negatif berarti potensi kekurangan stok.</div>
          </div>
        </CardContent>
      </Card>

      {/* RIWAYAT */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
            <CardTitle className="text-xl flex items-center gap-2">
              <History className="h-6 w-6" /> Riwayat Update Stok
            </CardTitle>
            <CardDescription className="text-gray-200">
              Catatan penyesuaian stok yang telah dilakukan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <StockReconciliationHistoryTable reconciliations={reportData.reconciliations} products={reportData.products} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;