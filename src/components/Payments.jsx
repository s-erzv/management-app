import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const Payments = ({ orderId, isEditable, orderTotal, onPaymentStatusUpdated }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const remainingDue = orderTotal - totalPaid;

  useEffect(() => {
    fetchPayments();
  }, [orderId]);

  const fetchPayments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId);

    if (error) {
      console.error('Error fetching payments:', error);
      toast.error('Gagal memuat pembayaran.');
    } else {
      setPayments(data);
    }
    setLoading(false);
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        method: paymentMethod,
        amount: newPaymentAmount,
      })
      .select();

    if (error) {
      console.error('Error adding payment:', error);
      toast.error('Gagal menambahkan pembayaran.');
    } else {
      toast.success('Pembayaran berhasil dicatat.');
      setPayments([...payments, ...data]);
      setNewPaymentAmount('');

      const newTotalPaid = totalPaid + parseFloat(newPaymentAmount);
      if (newTotalPaid >= orderTotal) {
        onPaymentStatusUpdated('paid');
      } else if (newTotalPaid > 0) {
        onPaymentStatusUpdated('partial');
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-lg font-semibold">
        <span>Total Pesanan</span>
        <span>Rp{orderTotal}</span>
      </div>
      <div className="flex items-center justify-between text-lg font-semibold text-green-600">
        <span>Total Terbayar</span>
        <span>Rp{totalPaid}</span>
      </div>
      <Separator />
      <div className="flex items-center justify-between text-lg font-semibold text-red-600">
        <span>Sisa Tagihan</span>
        <span>Rp{remainingDue}</span>
      </div>
      
      {isEditable && remainingDue > 0 && (
        <form onSubmit={handleAddPayment} className="space-y-4 mt-6">
          <Input
            type="number"
            placeholder="Jumlah Pembayaran"
            value={newPaymentAmount}
            onChange={(e) => setNewPaymentAmount(e.target.value)}
            required
            min="1"
          />
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger>
              <SelectValue placeholder="Metode Pembayaran" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Tunai</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="qris">QRIS</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={loading} className="w-full">
            Catat Pembayaran
          </Button>
        </form>
      )}

      {payments.length > 0 && (
        <div className="pt-4">
          <h3 className="text-md font-medium mb-2">Riwayat Pembayaran</h3>
          <ul className="text-sm space-y-1">
            {payments.map(p => (
              <li key={p.id} className="flex justify-between">
                <span>Rp{p.amount} ({p.method})</span>
                <span className="text-gray-500">{new Date(p.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Payments;