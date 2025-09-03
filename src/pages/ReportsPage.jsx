import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
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
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
  <div className="container mx-auto p-4 md:p-8 space-y-8">
    <h1 className="text-2xl font-bold mb-6">Laporan & Analisis</h1>

    <Card>
      <CardHeader>
        <CardTitle>Stok vs Permintaan per Produk</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Tambahkan pengecekan ini sebelum merender grafik */}
        {reportData.chartData && reportData.chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={500}>
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
              <Legend verticalAlign="top" align="right" height={36}/>
              <Tooltip />
              <Line
                type="monotone"
                dataKey="stock"
                stroke="#0000ff"
                name="Stok"
              />
              <Line
                type="monotone"
                dataKey="demand"
                stroke="#ff0000"
                name="Permintaan"
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
    
    <ProductStockTable products={reportData.products} />
    <StockReconciliationHistoryTable reconciliations={reportData.reconciliations} products={reportData.products} />
    <DemandReportTable demandData={reportData.demand} />
      
  </div>
);
};

export default ReportsPage;