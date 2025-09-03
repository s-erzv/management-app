import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ProductStockTable = ({ products }) => {
  const currentDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'numeric', day: 'numeric' });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stok Produk Saat Ini</CardTitle>
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
              <TableRow>
                <TableCell className="font-medium">{currentDate}</TableCell>
                {products.map(product => (
                  <TableCell key={product.id}>{product.stock}</TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductStockTable;