import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, TrendingUp, Package, History, BarChart } from "lucide-react";
import { toast } from "react-hot-toast";
import ProductStockTable from '@/components/reports/ProductStockTable';
import DemandReportTable from '@/components/reports/DemandReportTable';
import StockReconciliationHistoryTable from '@/components/reports/StockReconciliationHistoryTable';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const ReportsPage = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    products: [],
    chartData: [],
    demand: [],
    reconciliations: [],
  });

  useEffect(() => {
    if (companyId) {
      fetchAllReportsData();
    }
  }, [companyId]);

  const fetchAllReportsData = async () => {
    setLoading(true);

    try {
      const { data: productsData, error: productError } = await supabase
        .from("products")
        .select("id, name, stock, is_returnable")
        .eq("company_id", companyId)
        .order("name", { ascending: true });
      if (productError) throw productError;

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
      
      const filteredOrderIds = filteredOrders.map((order) => order.id);
      
      const { data: demandItems, error: demandItemsError } = await supabase
        .from("order_items")
        .select(`product_id, qty`)
        .in("order_id", filteredOrderIds);
      if (demandItemsError) throw demandItemsError;

      const demandByProduct = demandItems.reduce((acc, item) => {
        acc[item.product_id] = (acc[item.product_id] || 0) + item.qty;
        return acc;
      }, {});

      const chartData = productsData.map((p) => ({
        name: p.name,
        stock: Number(p.stock) || 0,
        demand: demandByProduct[p.id] || 0,
      }));

      const demandTableData = productsData.map((p) => {
        return {
          name: p.name,
          demand: demandByProduct[p.id] || 0,
        };
      });

      setReportData({
        products: productsData,
        chartData: chartData,
        demand: demandTableData,
        reconciliations: reconciliationsData,
      });

    } catch (error) {
      console.error('Error fetching all reports data:', error);
      toast.error('Gagal memuat data laporan.');
      setReportData({
        products: [],
        chartData: [],
        demand: [],
        reconciliations: [],
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#10182b]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
          <BarChart className="h-8 w-8" />
          Laporan & Analisis
        </h1>
      </div>

      <Card className="border-0 shadow-lg bg-white">
        <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
          <CardTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="h-6 w-6" /> Stok vs Permintaan per Produk
          </CardTitle>
          <CardDescription className="text-gray-200">
            Perbandingan visual stok tersedia dengan total permintaan dari pesanan aktif.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {reportData.chartData && reportData.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={reportData.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={100}
                />
                <YAxis />
                <Tooltip />
                <Legend verticalAlign="top" align="right" height={36}/>
                <Line
                  type="monotone"
                  dataKey="stock"
                  stroke="#10182b"
                  name="Stok"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="demand"
                  stroke="#ff6b6b"
                  name="Permintaan"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex justify-center items-center h-40">
              <p className="text-muted-foreground">Tidak ada data untuk grafik.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-t-lg border-b">
              <CardTitle className="text-xl flex items-center gap-2">
                <Package className="h-6 w-6" /> Stok Produk Saat Ini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <ProductStockTable products={reportData.products} />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-t-lg border-b">
              <CardTitle className="text-xl flex items-center gap-2">
                <TrendingUp className="h-6 w-6" /> Total Permintaan per Produk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <DemandReportTable demandData={reportData.demand} />
              </div>
            </CardContent>
          </Card>
        </div>

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