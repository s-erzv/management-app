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

// Import for Excel
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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
        companiesList = companiesData;
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
          supabase.from('orders').select(`*, customers(name, phone), order_items(products(name, is_returnable), qty, price), order_couriers(courier:profiles(full_name))`).eq('company_id', comp.id),
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
        
        if (userProfile.role === 'super_admin') {
             allData[comp.id].companies = companiesData;
        }
      }
      setCompaniesData(allData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat semua data dari database.');
    } finally {
      setLoading(false);
    }
  };
  
  const exportAllToExcel = () => {
  const dataToExport = companiesData[activeTab];
  if (!dataToExport) {
      toast.error('Tidak ada data yang dapat diekspor.');
      return;
  }
  
  const wb = XLSX.utils.book_new();

  // Flatten and prepare data for each sheet
  // Customers
  const customersSheet = dataToExport.customers.map(c => ({
    ID: c.id,
    Nama: c.name,
    Telepon: c.phone,
    Alamat: c.address,
    Status: c.customer_statuses?.status_name || '-',
    'ID Perusahaan': c.company_id,
  }));
  if (customersSheet.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customersSheet), 'Pelanggan');
  }

  // Products
  const productsSheet = dataToExport.products.map(p => ({
    ID: p.id,
    Nama: p.name,
    Stok: p.stock,
    'Harga Beli': p.purchase_price,
    'Dapat Dikembalikan': p.is_returnable ? 'Ya' : 'Tidak',
    'Harga Galon Kosong': p.empty_bottle_price,
    'ID Perusahaan': p.company_id,
    'Harga Per Status': p.product_prices.map(pp => `${pp.customer_status}: Rp${pp.price}`).join(', ')
  }));
  if (productsSheet.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productsSheet), 'Produk');
  }

  // Orders
  const ordersSheet = dataToExport.orders.map(o => ({
    'ID Pesanan': o.id,
    'Nomor Invoice': o.invoice_number,
    'Tanggal Order': o.created_at,
    'Tanggal Rencana Kirim': o.planned_date,
    Status: o.status,
    'Status Pembayaran': o.payment_status,
    'Total Harga': o.grand_total,
    'Biaya Transportasi': o.transport_cost,
    'Galon Kembali': o.returned_qty,
    'Galon Dipinjam': o.borrowed_qty,
    'Galon Kosong Dibeli': o.purchased_empty_qty,
    'Nama Pelanggan': o.customers?.name,
    'Nomor Telepon Pelanggan': o.customers?.phone,
    'Item Pesanan': o.order_items.map(i => `${i.products?.name} (${i.qty} @ Rp${i.price})`).join('; '),
    'Kurir Ditugaskan': o.order_couriers.map(oc => oc.courier?.full_name).join(', '),
  }));
  if (ordersSheet.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersSheet), 'Pesanan');
  }

  // Profiles
  const profilesSheet = dataToExport.profiles.map(p => ({
    'ID Pengguna': p.id,
    'Nama Lengkap': p.full_name,
    Email: p.email,
    Rekening: p.rekening,
    Peran: p.role,
    'ID Perusahaan': p.company_id,
    'Nama Perusahaan': p.companies?.name,
  }));
  if (profilesSheet.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(profilesSheet), 'Pengguna');
  }

  // Payment Methods
  const paymentMethodsSheet = dataToExport.payment_methods.map(pm => ({
      ID: pm.id,
      Nama: pm.method_name,
      Tipe: pm.type,
      'Nama Akun': pm.account_name,
      'Nomor Akun': pm.account_number,
      'ID Perusahaan': pm.company_id,
  }));
  if (paymentMethodsSheet.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentMethodsSheet), 'Metode Pembayaran');
  }
  
  // Companies (only for super_admin)
  // Perbaikan: Menggunakan state 'companies' yang sudah berisi semua data perusahaan
  if (userProfile?.role === 'super_admin') {
      const companiesSheet = companies.map(c => ({
          ID: c.id,
          'Nama Perusahaan': c.name,
          'Dibuat Pada': c.created_at,
          'Link Google Sheets': c.google_sheets_link,
      }));
      if (companiesSheet.length > 0) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(companiesSheet), 'Perusahaan');
      }
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const companyNameForFile = companies.find(c => c.id === activeTab)?.name || 'Data';
  saveAs(blob, `Data_Export_${companyNameForFile}_${new Date().toLocaleDateString()}.xlsx`);
  toast.success(`Semua data dari ${companyNameForFile} berhasil diekspor!`);
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
        <Button onClick={exportAllToExcel} className="flex items-center gap-2 w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90">
            <Download className="h-4 w-4" /> Export All to Excel
        </Button>
      </div>

      {userProfile.role === 'super_admin' ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto pb-4 scrollbar-hide">
            <TabsList className="flex flex-nowrap justify-start lg:grid lg:w-fit lg:grid-cols-6 bg-gray-100 p-1">
              {companies.map((comp) => (
                <TabsTrigger key={comp.id} value={comp.id} className="whitespace-nowrap">
                  {comp.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {companies.map((comp) => (
            <TabsContent key={comp.id} value={comp.id} className="space-y-8 mt-6">
              {tables.map(table => (
                <Card key={table.name} className="border-0 shadow-lg bg-white">
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle>{table.name}</CardTitle>
                      <CardDescription>Total {table.data?.length || 0} entri</CardDescription>
                    </div>
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