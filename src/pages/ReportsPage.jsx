import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

// Recharts
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
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (companyId) {
      fetchChartData();
    }
  }, [companyId]);

  const fetchChartData = async () => {
  setLoading(true);

  // 1. Ambil semua produk dari company
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, stock")
    .eq("company_id", companyId);

  if (productError) {
    console.error("Error fetching products:", productError);
    toast.error("Gagal memuat produk.");
    setLoading(false);
    return;
  }

  // 2. Ambil id dari orders dengan status "draft" atau "sent"
  const { data: filteredOrders, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("company_id", companyId)
    .in("status", ["draft", "sent"]);

  if (orderError) {
    console.error("Error fetching filtered orders:", orderError);
    toast.error("Gagal memuat data order.");
    setLoading(false);
    return;
  }

  const filteredOrderIds = filteredOrders.map((order) => order.id);

  // 3. Ambil order_items yang berelasi dengan id yang sudah difilter
  const { data: demandData, error: demandError } = await supabase
    .from("order_items")
    .select(`
      product_id,
      qty
    `)
    .in("order_id", filteredOrderIds);


  if (demandError) {
    console.error("Error fetching demand:", demandError);
    toast.error("Gagal memuat permintaan.");
    setLoading(false);
    return;
  }

  console.log("Demand Data (filtered):", demandData);

  // 4. Hitung total permintaan per produk
  const demandByProduct = demandData.reduce((acc, item) => {
    acc[item.product_id] = (acc[item.product_id] || 0) + item.qty;
    return acc;
  }, {});

  // 5. Gabungkan stok & demand ke chartData
  const data = products.map((p) => ({
    name: p.name,
    stock: Number(p.stock) || 0,
    demand: demandByProduct[p.id] || 0,
  }));

  setChartData(data);
  setLoading(false);
};


  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">Grafik Kebutuhan</h1>

      <Card>
        <CardHeader>
          <CardTitle>Stok vs Permintaan per Produk</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis />
              <Tooltip />
              <Legend />
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
