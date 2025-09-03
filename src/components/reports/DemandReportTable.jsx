import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DemandReportTable = ({ demandData }) => {
  const currentDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'numeric', day: 'numeric' });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Permintaan per Produk</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Tanggal</TableHead>
                {demandData.map(item => (
                  <TableHead key={item.name}>{item.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">{currentDate}</TableCell>
                {demandData.map(item => (
                  <TableCell key={item.name}>{item.demand}</TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default DemandReportTable;