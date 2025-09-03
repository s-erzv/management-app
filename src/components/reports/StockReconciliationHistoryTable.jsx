import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const StockReconciliationHistoryTable = ({ reconciliations, products }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Rekonsiliasi Stok</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Tanggal</TableHead>
                {products.map(product => (
                  <TableHead key={product.id}>{product.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliations.length > 0 ? (
                reconciliations.map(rec => (
                  <TableRow key={rec.id}>
                    <TableCell>{new Date(rec.reconciliation_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                    {products.map(product => {
                      const item = rec.items.find(i => i.product_id === product.id);
                      if (!item) return <TableCell key={product.id}>-</TableCell>;
                      const cellClass = item.difference > 0 ? 'text-green-600' : item.difference < 0 ? 'text-red-600' : 'text-gray-500';
                      // Menampilkan hanya jumlah stok fisik
                      const displayValue = item.physical_count;
                      return <TableCell key={product.id} className={cellClass}>{displayValue}</TableCell>;
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={products.length + 1} className="text-center text-muted-foreground py-8">
                    Tidak ada riwayat rekonsiliasi.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default StockReconciliationHistoryTable;