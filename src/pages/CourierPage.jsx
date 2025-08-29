// src/pages/CourierPage.jsx
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
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ProofOfDeliveryForm from '@/components/ProofOfDeliveryForm';

const CourierPage = () => {
  const { session } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

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
          order_items (product_id, qty, price, item_type, products(is_returnable, company_id))
        `)
        .eq('courier_id', session.user.id)
        .order('planned_date', { ascending: true });

      if (tasksError) {
        console.error('Error fetching data:', tasksError);
        toast.error('Gagal memuat data tugas.');
      } else {
        const tasksWithTotals = tasksData.map(order => {
          const total = order.order_items.reduce((sum, item) => sum + (item.qty * item.price), 0);
          return { ...order, total };
        });
        
        const orderIds = tasksWithTotals.map(t => t.id);
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('order_id, amount')
          .in('order_id', orderIds);
          
        if (paymentsError) {
          console.error('Error fetching payments:', paymentsError);
        } else {
          const paymentsByOrderId = paymentsData.reduce((acc, curr) => {
            acc[curr.order_id] = (acc[curr.order_id] || 0) + curr.amount;
            return acc;
          }, {});

          const finalTasks = tasksWithTotals.map(task => ({
            ...task,
            total_paid: paymentsByOrderId[task.id] || 0,
            remaining_due: task.total - (paymentsByOrderId[task.id] || 0)
          }));
          setTasks(finalTasks);
        }
      }
    }
    setLoading(false);
  };
  
  const updateOrderStatus = async (order, newStatus) => {
    if (order.status === 'completed') {
      toast.error('Pesanan sudah selesai dan tidak bisa diperbarui lagi.');
      return;
    }
    setLoading(true);
    
    if (newStatus === 'sent') {
      const soldItems = order.order_items.filter(item => item.item_type === 'beli');
      if (soldItems.length > 0) {
        for (const item of soldItems) {
          const company_id = item.products.company_id;
          const { error } = await supabase
            .from('stock_movements')
            .insert({
              type: 'keluar',
              qty: item.qty,
              notes: `Galon keluar untuk pesanan #${order.id.slice(0, 8)} (dibeli)`,
              order_id: order.id,
              user_id: session.user.id,
              product_id: item.product_id,
              company_id: company_id
            });
          if (error) {
            console.error('Error recording stock movement:', error);
            toast.error('Gagal mencatat pergerakan stok.');
            setLoading(false);
            return;
          }
        }
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
  
  const handleOpenCompletionModal = (order) => {
    setCurrentOrder(order);
    setIsCompletionModalOpen(true);
  };

  const handleCompleteDelivery = async (formData) => {
    setLoading(true);
    const { 
      paymentAmount, 
      paymentMethod, // Ditambahkan
      returnedQty, 
      borrowedQty, 
      transportCost, 
      proofFileUrl 
    } = formData;
    const { id: orderId, total, total_paid } = currentOrder;

    try {
      let newPaymentStatus = currentOrder.payment_status;
      const totalPaidAfterNew = total_paid + paymentAmount; // Gunakan paymentAmount dari form
      if (totalPaidAfterNew >= total) {
        newPaymentStatus = 'paid';
      } else if (totalPaidAfterNew > 0) {
        newPaymentStatus = 'partial';
      }

      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/complete-delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          orderId,
          paymentAmount,
          paymentMethod, // Ditambahkan
          returnedQty: parseInt(returnedQty) || 0,
          borrowedQty: parseInt(borrowedQty) || 0,
          purchasedEmptyQty: parseInt(formData.purchasedEmptyQty) || 0, // Ditambahkan
          transportCost: parseFloat(transportCost) || 0,
          proofFileUrl,
          newPaymentStatus
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      toast.success('Pesanan berhasil diselesaikan!');
      setIsCompletionModalOpen(false);
      fetchData();

    } catch (error) {
      console.error('Error completing delivery:', error);
      toast.error('Gagal menyelesaikan pesanan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">Tugas Pengiriman Saya</h1>
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <p className="text-center text-muted-foreground">Tidak ada tugas pengiriman yang ditugaskan.</p>
        ) : (
          tasks.map(task => {
            return (
              <Card key={task.id}>
                <CardHeader>
                  <CardTitle>Pesanan #{task.id.slice(0, 8)}</CardTitle>
                  <CardDescription>{task.customers?.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>Alamat: <span className="font-medium">{task.customers?.address}</span></div>
                  <div>Status: <Badge>{task.status}</Badge></div>
                  <div className="text-sm font-medium">
                    <p>Total Pesanan: Rp{task.total}</p>
                    <p>Total Terbayar: Rp{task.total_paid}</p>
                    <p>Sisa Tagihan: <span className="text-red-600">Rp{task.remaining_due}</span></p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {task.status === 'draft' && (
                       <Button onClick={() => updateOrderStatus(task, 'sent')}>Tandai Dikirim</Button>
                    )}
                    {task.status === 'sent' && (
                      <Button onClick={() => handleOpenCompletionModal(task)} disabled={loading}>
                        Selesaikan Pesanan
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      
      {isCompletionModalOpen && (
        <ProofOfDeliveryForm
          isOpen={isCompletionModalOpen}
          onOpenChange={setIsCompletionModalOpen}
          order={currentOrder}
          onCompleteDelivery={handleCompleteDelivery}
        />
      )}
    </div>
  );
};

export default CourierPage;
