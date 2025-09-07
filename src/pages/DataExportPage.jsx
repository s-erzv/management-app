import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'react-hot-toast';
import { Loader2, Database, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DataExportPage = () => {
  const { userProfile, companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companiesData, setCompaniesData] = useState({});

  useEffect(() => {
    if (userProfile?.role === 'super_admin' || userProfile?.role === 'admin') {
      fetchCompaniesAndData();
    } else {
      setLoading(false);
    }
  }, [userProfile, companyId]);

  const fetchCompaniesAndData = async () => {
    setLoading(true);
    try {
      let companiesList = [];
      if (userProfile.role === 'super_admin') {
        const { data: companiesData, error } = await supabase.from('companies').select('id, name');
        if (error) throw error;
        companiesList = companiesData; // Perbaikan di sini
        setCompanies(companiesList);
        if (companiesList.length > 0) {
          setActiveTab(companiesList[0].id);
        }
      } else {
        companiesList = [{ id: companyId, name: userProfile?.companies?.name || 'My Company' }];
        setCompanies(companiesList);
        setActiveTab(companyId);
      }

      const allData = {};
      for (const comp of companiesList) {
        const fetchQueries = [
          supabase.from('customers').select('*, customer_statuses(status_name)').eq('company_id', comp.id),
          supabase.from('products').select('*, product_prices(*, customer_statuses(status_name))').eq('company_id', comp.id),
          supabase.from('orders').select(`*, customers(name), order_items(products(name, is_returnable), qty, price), order_couriers(courier:profiles(full_name))`).eq('company_id', comp.id),
          supabase.from('profiles').select('*, companies(name)').eq('company_id', comp.id),
          supabase.from('payment_methods').select('*').eq('company_id', comp.id),
        ];

        const [customersData, productsData, ordersData, profilesData, paymentMethodsData] = await Promise.all(fetchQueries);

        allData[comp.id] = {
          customers: customersData.data,
          products: productsData.data,
          orders: ordersData.data,
          profiles: profilesData.data,
          payment_methods: paymentMethodsData.data,
        };
      }
      setCompaniesData(allData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat semua data dari database.');
    } finally {
      setLoading(false);
    }
  };
  
  const exportToExcel = (tableData, fileName) => {
    const header = Object.keys(tableData[0] || {});
    const csvRows = tableData.map(row => 
        header.map(fieldName => {
            const value = row[fieldName];
            if (typeof value === 'object' && value !== null) {
                return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            return `"${(value || '').toString().replace(/"/g, '""')}"`;
        }).join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8," + header.join(',') + "\n" + csvRows.join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Data ${fileName} berhasil diekspor!`);
  };
  
  const isAdminOrSuperAdmin = userProfile?.role === 'super_admin' || userProfile?.role === 'admin';

  if (!isAdminOrSuperAdmin) {
    return <p className="text-center text-red-500">Anda tidak memiliki akses ke halaman ini.</p>;
  }

  if (loading || !activeTab) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  const tables = [
    ...(userProfile?.role === 'super_admin' ? [{ name: 'Perusahaan', data: companiesData[activeTab]?.companies, fileName: 'companies' }] : []),
    { name: 'Pelanggan', data: companiesData[activeTab]?.customers, fileName: 'customers' },
    { name: 'Produk', data: companiesData[activeTab]?.products, fileName: 'products' },
    { name: 'Pesanan', data: companiesData[activeTab]?.orders, fileName: 'orders' },
    { name: 'Profil Pengguna', data: companiesData[activeTab]?.profiles, fileName: 'profiles' },
    { name: 'Metode Pembayaran', data: companiesData[activeTab]?.payment_methods, fileName: 'payment_methods' },
  ];

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Database className="h-8 w-8" />
          Data Center
        </h1>
        <p className="text-muted-foreground">
          Kelola dan unduh semua data dari database.
        </p>
      </div>

      {userProfile.role === 'super_admin' ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:w-fit">
            {companies.map((comp) => (
              <TabsTrigger key={comp.id} value={comp.id}>
                {comp.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {companies.map((comp) => (
            <TabsContent key={comp.id} value={comp.id} className="space-y-8 mt-6">
              {tables.map(table => (
                <Card key={table.name} className="border-0 shadow-lg bg-white">
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle>{table.name}</CardTitle>
                      <CardDescription>Total {table.data?.length || 0} entri</CardDescription>
                    </div>
                    {table.data && table.data.length > 0 && (
                      <Button onClick={() => exportToExcel(table.data, `${table.fileName}_${comp.name}`)} className="bg-[#10182b] text-white hover:bg-[#10182b]/90">
                        <Download className="h-4 w-4 mr-2" />
                        Unduh Excel
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {table.data && table.data.length > 0 ? (
                      <div className="overflow-x-auto rounded-md border">
                        <Table className="table-auto min-w-max">
                          <TableHeader>
                            <TableRow>
                              {Object.keys(table.data[0]).map(key => (
                                <TableHead key={key}>{key}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {table.data.slice(0, 5).map((row, index) => (
                              <TableRow key={index}>
                                {Object.values(row).map((value, idx) => (
                                  <TableCell key={idx}>
                                      {typeof value === 'object' && value !== null
                                          ? JSON.stringify(value, null, 2)
                                          : value?.toString() || '-'}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p>Tidak ada data untuk tabel ini.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="space-y-8">
            {tables.map(table => (
              <Card key={table.name} className="border-0 shadow-lg bg-white">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>{table.name}</CardTitle>
                    <CardDescription>Total {table.data?.length || 0} entri</CardDescription>
                  </div>
                  {table.data && table.data.length > 0 && (
                    <Button onClick={() => exportToExcel(table.data, `${table.fileName}_${companies.find(c => c.id === companyId)?.name || 'data'}`)} className="bg-[#10182b] text-white hover:bg-[#10182b]/90">
                      <Download className="h-4 w-4 mr-2" />
                      Unduh Excel
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {table.data && table.data.length > 0 ? (
                    <div className="overflow-x-auto rounded-md border">
                      <Table className="table-auto min-w-max">
                        <TableHeader>
                          <TableRow>
                            {Object.keys(table.data[0]).map(key => (
                              <TableHead key={key}>{key}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {table.data.slice(0, 5).map((row, index) => (
                            <TableRow key={index}>
                              {Object.values(row).map((value, idx) => (
                                <TableCell key={idx}>
                                    {typeof value === 'object' && value !== null
                                        ? JSON.stringify(value, null, 2)
                                        : value?.toString() || '-'}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p>Tidak ada data untuk tabel ini.</p>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
};

export default DataExportPage;