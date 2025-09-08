import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SuperAdminDashboard = ({ profile, data }) => {
  const [selectedProductId, setSelectedProductId] = useState(data.products[0]?.id);
  const selectedProduct = data.products.find(p => p.id === selectedProductId);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Dashboard Super Admin</h2>
      <p className="text-gray-600">Selamat datang, {profile.full_name}! Ringkasan sistem secara keseluruhan.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle>Total Order Hari Ini</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.totalOrdersToday}</p></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Stok Produk</span>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Pilih Produk" />
                </SelectTrigger>
                <SelectContent>
                  {data.products.map(product => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{selectedProduct?.stock ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Order Lunas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.paidOrders}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Order Pending</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.unpaidOrders}</p></CardContent>
        </Card>
      </div>

      <Alert>
        <RocketIcon className="h-4 w-4" />
        <AlertTitle>Akses Penuh</AlertTitle>
        <AlertDescription>
          Anda memiliki akses penuh untuk mengelola pengguna dan semua data.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default SuperAdminDashboard;
