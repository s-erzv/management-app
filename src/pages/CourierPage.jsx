import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ProofOfDeliveryForm from '@/components/ProofOfDeliveryForm';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const CourierPage = () => {
  const { session } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

  const [returnForm, setReturnForm] = useState({
    orderId: null,
    productId: null,
    returnedQty: 0,
    deliveredQty: 0,
    notes: 'Pengembalian galon dari pelanggan',
  });

  useEffect(() => {
    fetchData();
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    if (session) {
      const { data: tasksData, error: tasksError } = await supabase
        .from('orders')
        .select(`
          *,
          customers (name, address),
          order_items (product_id, qty, products(is_returnable))
        `)
        .eq('courier_id', session.user.id)
        .order('planned_date', { ascending: true });

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name');

      if (tasksError || productsError) {
        console.error('Error fetching data:', tasksError || productsError);
        toast.error('Gagal memuat data tugas.');
      } else {
        setTasks(tasksData);
        setProducts(productsData);
      }
    }
    setLoading(false);
  };
  
  const recordStockMovement = async (type, qty, order_id, product_id, notes) => {
    const { error } = await supabase
      .from('stock_movements')
      .insert({
        type: type,
        qty: qty,
        notes: notes,
        order_id: order_id,
        user_id: session.user.id,
        product_id: product_id,
      });

    if (error) {
      console.error('Error recording stock movement:', error);
      toast.error('Gagal mencatat pergerakan stok.');
      return false;
    }
    return true;
  };
  
  const handleOpenProofModal = (order) => {
    setCurrentOrder(order);
    setIsProofModalOpen(true);
  };
  
  const handleProofUploadSuccess = () => {
    fetchData(); 
  };
  
  const updateOrderStatus = async (order, newStatus) => {
    if (order.status === 'completed') {
      toast.error('Pesanan sudah selesai dan tidak bisa diperbarui lagi.');
      return;
    }
    setLoading(true);
    
    if (newStatus === 'completed') {
      const totalGalon = order.order_items.reduce((sum, item) => sum + item.qty, 0);
      const mainProductId = order.order_items[0]?.product_id;
      
      const movementSuccess = await recordStockMovement('keluar', totalGalon, order.id, mainProductId, `Galon keluar untuk pesanan #${order.id.slice(0, 8)}`);
      
      if (!movementSuccess) {
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id);

    if (error) {
      console.error('Error updating status:', error);
      toast.error('Gagal memperbarui status.');
    } else {
      toast.success('Status berhasil diperbarui!');
      fetchData();
    }
    setLoading(false);
  };
  
  const handleOpenReturnModal = (order) => {
    const deliveredQty = order.order_items.reduce((sum, item) => sum + item.qty, 0);
    const mainProductId = order.order_items[0]?.product_id;
    setReturnForm({
      orderId: order.id,
      productId: mainProductId,
      deliveredQty: deliveredQty,
      returnedQty: deliveredQty,
    });
    setIsReturnModalOpen(true);
  };
  
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { orderId, productId, deliveredQty, returnedQty } = returnForm;
    
    if (returnedQty > 0) {
      await recordStockMovement('pengembalian', returnedQty, orderId, productId, `Pengembalian galon dari pelanggan`);
    }

    if (deliveredQty - returnedQty > 0) {
      const missingQty = deliveredQty - returnedQty;
      // TODO: Logika untuk mencatat kekurangan galon di sini jika diperlukan
      toast.info(`Terdapat kekurangan ${missingQty} galon.`);
    }
    
    toast.success('Catatan pengembalian berhasil disimpan!');
    setIsReturnModalOpen(false);
    setReturnForm({ orderId: null, productId: null, returnedQty: 0, deliveredQty: 0, notes: '' });
    fetchData();
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
      <h1 className="text-2xl font-bold mb-6">Tugas Pengiriman Saya</h1>
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <p className="text-center text-muted-foreground">Tidak ada tugas pengiriman yang ditugaskan.</p>
        ) : (
          tasks.map(task => {
            const hasReturnableItems = task.order_items.some(item => item.products?.is_returnable);
            return (
              <Card key={task.id}>
                <CardHeader>
                  <CardTitle>Pesanan #{task.id.slice(0, 8)}</CardTitle>
                  <CardDescription>{task.customers?.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>Alamat: <span className="font-medium">{task.customers?.address}</span></div>
                  <div>Status: <Badge>{task.status}</Badge></div>
                  <div className="flex gap-2 mt-4">
                    {task.status === 'draft' && (
                       <Button onClick={() => updateOrderStatus(task, 'sent')}>Tandai Dikirim</Button>
                    )}
                    {task.status === 'sent' && (
                      <>
                        <Button onClick={() => handleOpenProofModal(task)}>Selesaikan Pesanan</Button>
                        {hasReturnableItems && (
                          <Button
                            variant="outline"
                            onClick={() => handleOpenReturnModal(task)}
                          >
                            Catat Pengembalian
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Pengembalian Galon</DialogTitle>
            <DialogDescription>
              Pesanan #{returnForm.orderId?.slice(0, 8)} dikirim {returnForm.deliveredQty} galon.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReturnSubmit}>
            <div className="grid gap-4 py-4">
              <Label htmlFor="returnedQty">Jumlah Galon Kembali</Label>
              <Input
                id="returnedQty"
                type="number"
                placeholder="Jumlah Galon Kembali"
                value={returnForm.returnedQty}
                onChange={(e) => setReturnForm({ ...returnForm, returnedQty: parseInt(e.target.value) || 0 })}
                required
                min="0"
                max={returnForm.deliveredQty}
              />
              <Label htmlFor="missingQty">Galon Hilang</Label>
              <Input
                id="missingQty"
                type="number"
                disabled
                value={returnForm.deliveredQty - returnForm.returnedQty}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Catat Pengembalian'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <ProofOfDeliveryForm
        isOpen={isProofModalOpen}
        onOpenChange={setIsProofModalOpen}
        order={currentOrder}
        onUploadSuccess={handleProofUploadSuccess}
      />
    </div>
  );
};

export default CourierPage;