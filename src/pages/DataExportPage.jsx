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
import { Loader2, Database, Download, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

// Import for Excel
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Fungsi untuk mentransformasi data agar lebih mudah dibaca di UI
const processDataForDisplay = (rawData, type, lookupData = {}) => {
  if (!rawData || rawData.length === 0) return [];

  return rawData.map(item => {
    const processedItem = { ...item };

    // Process berbagai ID fields berdasarkan lookup data
    if (processedItem.company_id && lookupData.companies) {
      const company = lookupData.companies.find(c => c.id === processedItem.company_id);
      processedItem.company_name = company?.name || 'Unknown Company';
    }


    if (processedItem.customer_id && lookupData.customers) {
      const customer = lookupData.customers.find(c => c.id === processedItem.customer_id);
      processedItem.customer_name = customer?.name || 'Unknown Customer';
    }

    if (processedItem.created_by && lookupData.profiles) {

      const creator = lookupData.profiles.find(p => p.id === processedItem.created_by);

      processedItem.created_by_name = creator?.full_name || 'Unknown User';

    }



    if (processedItem.user_id && lookupData.profiles) {

      const user = lookupData.profiles.find(p => p.id === processedItem.user_id);

      processedItem.user_name = user?.full_name || 'Unknown User';

    }



    if (processedItem.courier_id && lookupData.profiles) {

      const courier = lookupData.profiles.find(p => p.id === processedItem.courier_id);

      processedItem.courier_name = courier?.full_name || 'Unknown Courier';

    }



    if (processedItem.received_by && lookupData.profiles) {

      const receiver = lookupData.profiles.find(p => p.id === processedItem.received_by);

      processedItem.received_by_name = receiver?.full_name || 'Unknown Receiver';

    }



    if (processedItem.payment_method_id && lookupData.payment_methods) {

      const paymentMethod = lookupData.payment_methods.find(pm => pm.id === processedItem.payment_method_id);

      processedItem.payment_method_name = paymentMethod?.method_name || 'Unknown Payment Method';

    }



    if (processedItem.product_id && lookupData.products) {

      const product = lookupData.products.find(p => p.id === processedItem.product_id);

      processedItem.product_name = product?.name || 'Unknown Product';

    }



    if (processedItem.category_id && lookupData.categories) {

      const category = lookupData.categories.find(c => c.id === processedItem.category_id);

      processedItem.category_name = category?.name || 'Unknown Category';

    }



    if (processedItem.subcategory_id && lookupData.subcategories) {

      const subcategory = lookupData.subcategories.find(s => s.id === processedItem.subcategory_id);

      processedItem.subcategory_name = subcategory?.name || 'Unknown Subcategory';

    }



    if (processedItem.supplier_id && lookupData.suppliers) {

      const supplier = lookupData.suppliers.find(s => s.id === processedItem.supplier_id);

      processedItem.supplier_name = supplier?.name || 'Unknown Supplier';

    }



    if (processedItem.order_id && lookupData.orders) {

      const order = lookupData.orders.find(o => o.id === processedItem.order_id);

      processedItem.order_invoice = order?.invoice_number || 'Unknown Invoice';

    }



    if (processedItem.customer_status && lookupData.customer_statuses) {

      const status = lookupData.customer_statuses.find(cs => cs.status_name === processedItem.customer_status);

      processedItem.customer_status_name = status?.status_name || 'Unknown Status';

    }



    // Process specific data types

    switch (type) {

      case 'orders':

        // Process order items

        if (processedItem.order_items && Array.isArray(processedItem.order_items)) {

          processedItem.order_items_display = processedItem.order_items.map(item => {

            const product = lookupData.products?.find(p => p.id === item.product_id);

            return `${product?.name || 'Unknown Product'} (${item.qty} x Rp${item.price?.toLocaleString()})`;

          }).join('; ');

        }

        

        // Process order couriers

        if (processedItem.order_couriers && Array.isArray(processedItem.order_couriers)) {

          processedItem.order_couriers_display = processedItem.order_couriers.map(oc => {

            const courier = lookupData.profiles?.find(p => p.id === oc.courier_id);

            return courier?.full_name || 'Unknown Courier';

          }).join(', ');

        }

        break;



      case 'products':

        // Process product prices

        if (processedItem.product_prices && Array.isArray(processedItem.product_prices)) {

          processedItem.product_prices_display = processedItem.product_prices.map(pp => {

            const status = lookupData.customer_statuses?.find(cs => cs.status_name === pp.customer_status);

            return `${status?.status_name || pp.customer_status}: Rp${pp.price?.toLocaleString()}`;

          }).join('; ');

        }

        break;



      case 'central_orders':

        // Process central order items

        if (processedItem.central_order_items && Array.isArray(processedItem.central_order_items)) {

          processedItem.central_order_items_display = processedItem.central_order_items.map(item => {

            const product = lookupData.products?.find(p => p.id === item.product_id);

            return `${product?.name || 'Unknown Product'} (${item.qty} x Rp${item.price?.toLocaleString()})`;

          }).join('; ');

        }

        break;



      case 'expense_reports':

        // Process expense report items

        if (processedItem.expense_report_items && Array.isArray(processedItem.expense_report_items)) {

          processedItem.expense_report_items_display = processedItem.expense_report_items.map(item => 

            `${item.description || 'No Description'} (Rp${item.amount?.toLocaleString()})`

          ).join('; ');

        }

        break;



      case 'invoices':

        // Process invoice items

        if (processedItem.invoice_items && Array.isArray(processedItem.invoice_items)) {

          processedItem.invoice_items_display = processedItem.invoice_items.map(item => {

            const product = lookupData.products?.find(p => p.id === item.product_id);

            return `${product?.name || item.description || 'Unknown Item'} (${item.quantity} x Rp${item.unit_price?.toLocaleString()})`;

          }).join('; ');

        }

        break;

    }



    // Format currency fields

    const currencyFields = ['price', 'purchase_price', 'empty_bottle_price', 'grand_total', 'transport_cost', 'amount', 'total_amount', 'total_transaction', 'subtotal', 'balance_due', 'paid_to_date'];

    currencyFields.forEach(field => {

      if (processedItem[field] && typeof processedItem[field] === 'number') {

        processedItem[`${field}_formatted`] = `Rp${processedItem[field].toLocaleString()}`;

      }

    });



    // Format date fields

    const dateFields = ['created_at', 'updated_at', 'planned_date', 'delivered_at', 'paid_at', 'order_date', 'report_date', 'transaction_date', 'issue_date', 'due_date', 'movement_date'];

    dateFields.forEach(field => {

      if (processedItem[field]) {

        const date = new Date(processedItem[field]);

        processedItem[`${field}_formatted`] = date.toLocaleDateString('id-ID');

      }

    });



    // Format boolean fields

    const booleanFields = ['is_active', 'is_returnable'];

    booleanFields.forEach(field => {

      if (typeof processedItem[field] === 'boolean') {

        processedItem[`${field}_formatted`] = processedItem[field] ? 'Ya' : 'Tidak';

      }

    });



    return processedItem;

  });

};



// Fungsi untuk memilih kolom yang akan ditampilkan

const selectDisplayColumns = (data, type) => {

  if (!data || data.length === 0) return [];



  const columnMappings = {

    companies: {

      'id': 'ID',

      'name': 'Nama Perusahaan',

      'created_at_formatted': 'Tanggal Dibuat',

      'google_sheets_link': 'Link Google Sheets'

    },

    customers: {

      'id': 'ID',

      'name': 'Nama Pelanggan',

      'phone': 'Nomor Telepon',

      'address': 'Alamat',

      'customer_status_name': 'Status Pelanggan',

      'company_name': 'Nama Perusahaan',

      'created_at_formatted': 'Tanggal Dibuat'

    },

    products: {

      'id': 'ID',

      'name': 'Nama Produk',

      'stock': 'Stok',

      'purchase_price_formatted': 'Harga Beli',

      'is_returnable_formatted': 'Dapat Dikembalikan',

      'empty_bottle_price_formatted': 'Harga Kemasan Returnable',

      'category_name': 'Kategori',

      'subcategory_name': 'Sub Kategori',

      'supplier_name': 'Pemasok',

      'company_name': 'Nama Perusahaan',

      'product_prices_display': 'Harga Per Status',

      'created_at_formatted': 'Tanggal Dibuat'

    },
    
    empty_bottle_stock: {
      'id': 'ID Produk',
      'name': 'Nama Produk',
      'empty_bottle_stock': 'Stok Kemasan Returnable',
      'empty_bottle_price_formatted': 'Harga Kemasan Returnable',
      'company_name': 'Nama Perusahaan',
    },

    orders: {

      'id': 'ID Pesanan',

      'invoice_number': 'Nomor Invoice',

      'customer_name': 'Nama Pelanggan',

      'status': 'Status',

      'payment_status': 'Status Pembayaran',

      'grand_total_formatted': 'Total Harga',

      'transport_cost_formatted': 'Biaya Transportasi',

      'returned_qty': 'Galon Kembali',

      'borrowed_qty': 'Galon Dipinjam',

      'purchased_empty_qty': 'Kemasan Returnable Dibeli',

      'planned_date_formatted': 'Tanggal Rencana',

      'delivered_at_formatted': 'Tanggal Kirim',

      'courier_name': 'Petugas',

      'created_by_name': 'Dibuat Oleh',

      'order_items_display': 'Item Pesanan',

      'order_couriers_display': 'Petugas Ditugaskan',

      'created_at_formatted': 'Tanggal Dibuat'

    },

    profiles: {

      'id': 'ID',

      'full_name': 'Nama Lengkap',

      'role': 'Peran',

      'rekening': 'Rekening',

      'company_name': 'Nama Perusahaan',

      'updated_at_formatted': 'Terakhir Update'

    },

    payment_methods: {

      'id': 'ID',

      'method_name': 'Nama Metode',

      'type': 'Tipe',

      'account_name': 'Nama Akun',

      'account_number': 'Nomor Akun',

      'is_active_formatted': 'Aktif',

      'company_name': 'Nama Perusahaan'

    },

    central_orders: {

      'id': 'ID',

      'order_date_formatted': 'Tanggal Order',

      'status': 'Status',

      'total_transaction_formatted': 'Total Transaksi',

      'central_note_number': 'Nomor Catatan',

      'user_name': 'Pengguna',

      'central_order_items_display': 'Item Pesanan',

      'created_at_formatted': 'Tanggal Dibuat'

    },

    expense_reports: {

      'id': 'ID',

      'report_date_formatted': 'Tanggal Laporan',

      'status': 'Status',

      'total_amount_formatted': 'Total Amount',

      'payment_method': 'Metode Pembayaran',

      'user_name': 'Pengguna',

      'expense_report_items_display': 'Item Pengeluaran',

      'created_at_formatted': 'Tanggal Dibuat'

    },

    financial_transactions: {

      'id': 'ID',

      'transaction_date_formatted': 'Tanggal Transaksi',

      'type': 'Tipe',

      'amount_formatted': 'Jumlah',

      'description': 'Deskripsi',

      'payment_method_name': 'Metode Pembayaran'

    },

    invoices: {

      'id': 'ID',

      'invoice_number': 'Nomor Invoice',

      'customer_name': 'Nama Pelanggan',

      'issue_date_formatted': 'Tanggal Invoice',

      'due_date_formatted': 'Jatuh Tempo',

      'status': 'Status',

      'grand_total_formatted': 'Grand Total',

      'balance_due_formatted': 'Sisa Bayar',

      'invoice_items_display': 'Item Invoice'

    },

    payments: {

      'id': 'ID',

      'order_invoice': 'Nomor Invoice',

      'amount_formatted': 'Jumlah',

      'paid_at_formatted': 'Tanggal Bayar',

      'payment_method_name': 'Metode Pembayaran',

      'received_by_name': 'Diterima Oleh',

      'reference': 'Referensi'

    },

    stock_movements: {

      'id': 'ID',

      'product_name': 'Nama Produk',

      'type': 'Tipe Gerakan',

      'qty': 'Jumlah',

      'movement_date_formatted': 'Tanggal Gerakan',

      'user_name': 'Pengguna',

      'notes': 'Catatan'

    },

    categories: {

      'id': 'ID',

      'name': 'Nama Kategori',

      'company_name': 'Nama Perusahaan',

      'created_at_formatted': 'Tanggal Dibuat'

    },

    subcategories: {

      'id': 'ID',

      'name': 'Nama Sub Kategori',

      'category_name': 'Nama Kategori',

      'created_at_formatted': 'Tanggal Dibuat'

    },

    suppliers: {

      'id': 'ID',

      'name': 'Nama Pemasok',

      'phone': 'Telepon',

      'location': 'Alamat',

      'company_name': 'Nama Perusahaan',

      'created_at_formatted': 'Tanggal Dibuat'

    },

  };



  const mapping = columnMappings[type] || {};

  

  return data.map(item => {

    const displayItem = {};

    Object.entries(mapping).forEach(([key, label]) => {

      displayItem[label] = item[key] || '-';

    });

    return displayItem;

  });

};



const DataExportPage = () => {

  const { userProfile, companyId } = useAuth();

  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(null);

  const [companies, setCompanies] = useState([]);

  const [companiesData, setCompaniesData] = useState({});

  const [processedData, setProcessedData] = useState({});
  
  const [searchQuery, setSearchQuery] = useState('');



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

      const processedDataAll = {};



      for (const comp of companiesList) {

        const fetchQueries = [

          supabase.from('customers').select('*, customer_statuses(status_name)').eq('company_id', comp.id),

          supabase.from('products').select('*, product_prices(*, customer_statuses(status_name)), categories(name), subcategories(name), suppliers(name)').eq('company_id', comp.id),

          supabase.from('orders').select(`*, customers(name, phone), order_items(*, products(name, is_returnable)), order_couriers(courier_id, profiles!order_couriers_courier_id_fkey(full_name))`).eq('company_id', comp.id),

          supabase.from('profiles').select('*, companies(name)').eq('company_id', comp.id),

          supabase.from('payment_methods').select('*').eq('company_id', comp.id),

          supabase.from('central_orders').select(`*, profiles!central_orders_user_id_fkey(full_name), central_order_items(*, products(name))`).eq('company_id', comp.id),

          supabase.from('expense_reports').select(`*, profiles!expense_reports_user_id_fkey(full_name), expense_report_items(*)`).eq('company_id', comp.id),

          supabase.from('financial_transactions').select(`*, payment_methods(method_name)`).eq('company_id', comp.id),

          supabase.from('invoices').select(`*, customers(name), invoice_items(*, products(name))`).eq('company_id', comp.id),

          supabase.from('payments').select(`*, orders(invoice_number), profiles!payments_received_by_fkey(full_name), payment_methods(method_name)`).eq('company_id', comp.id),

          supabase.from('stock_movements').select(`*, products(name), profiles!stock_movements_user_id_fkey(full_name)`).eq('company_id', comp.id),

          supabase.from('categories').select('*').eq('company_id', comp.id),

          supabase.from('suppliers').select('*').eq('company_id', comp.id),

          supabase.from('subcategories').select('*, categories(name)').eq('company_id', comp.id),

          supabase.from('customer_statuses').select('*').eq('company_id', comp.id),

        ];



        const [

          customersData,

          productsData,

          ordersData,

          profilesData,

          paymentMethodsData,

          centralOrdersData,

          expenseReportsData,

          financialTransactionsData,

          invoicesData,

          paymentsData,

          stockMovementsData,

          categoriesData,

          suppliersData,

          subcategoriesData,

          customerStatusesData,

        ] = await Promise.all(fetchQueries);



        // Raw data

        allData[comp.id] = {

          customers: customersData.data,

          products: productsData.data,

          orders: ordersData.data,

          profiles: profilesData.data,

          payment_methods: paymentMethodsData.data,

          central_orders: centralOrdersData.data,

          expense_reports: expenseReportsData.data,

          financial_transactions: financialTransactionsData.data,

          invoices: invoicesData.data,

          payments: paymentsData.data,

          stock_movements: stockMovementsData.data,

          categories: categoriesData.data,

          suppliers: suppliersData.data,

          subcategories: subcategoriesData.data,

          customer_statuses: customerStatusesData.data,

        };

        

        if (userProfile.role === 'super_admin') {

          const { data: companiesData } = await supabase.from('companies').select('*');

          allData[comp.id].companies = companiesData;

        }



        // Create lookup data for processing

        const lookupData = {

          companies: userProfile.role === 'super_admin' ? allData[comp.id].companies : [{ id: comp.id, name: comp.name }],

          customers: customersData.data,

          products: productsData.data,

          profiles: profilesData.data,

          payment_methods: paymentMethodsData.data,

          categories: categoriesData.data,

          subcategories: subcategoriesData.data,

          suppliers: suppliersData.data,

          orders: ordersData.data,

          customer_statuses: customerStatusesData.data,

        };



        // Process data for display

        processedDataAll[comp.id] = {};
        
        // Process products table as a whole
        const productsRawData = allData[comp.id].products;
        if (productsRawData) {
          const processedRawProducts = processDataForDisplay(productsRawData, 'products', lookupData);
          processedDataAll[comp.id]['products'] = selectDisplayColumns(processedRawProducts, 'products');
          
          // Separate out the returnable products for the empty bottle stock table
          const emptyBottleProducts = productsRawData.filter(p => p.is_returnable);
          const processedEmptyBottleProducts = processDataForDisplay(emptyBottleProducts, 'products', lookupData);
          processedDataAll[comp.id]['empty_bottle_stock'] = selectDisplayColumns(processedEmptyBottleProducts, 'empty_bottle_stock');
        }

        // Process other tables
        const otherTables = [
            'customers', 'orders', 'profiles', 'payment_methods', 'central_orders', 
            'expense_reports', 'financial_transactions', 'invoices', 'payments', 
            'stock_movements', 'categories', 'suppliers', 'subcategories', 'customer_statuses'
        ];
        
        otherTables.forEach(tableName => {
            const data = allData[comp.id][tableName];
            if (data) {
                const processedRawData = processDataForDisplay(data, tableName, lookupData);
                processedDataAll[comp.id][tableName] = selectDisplayColumns(processedRawData, tableName);
            }
        });
        
        if (userProfile.role === 'super_admin') {
          const data = allData[comp.id].companies;
          if (data) {
            const processedRawData = processDataForDisplay(data, 'companies', lookupData);
            processedDataAll[comp.id]['companies'] = selectDisplayColumns(processedRawData, 'companies');
          }
        }
      }

      

      setCompaniesData(allData);

      setProcessedData(processedDataAll);

    } catch (error) {

      console.error('Error fetching data:', error);

      toast.error('Gagal memuat semua data dari database.');

    } finally {

      setLoading(false);

    }

  };

  

  const exportAllToExcel = () => {

    const dataToExport = processedData[activeTab];

    if (!dataToExport) {

      toast.error('Tidak ada data yang dapat diekspor.');

      return;

    }

  

    const wb = XLSX.utils.book_new();



    // Export each table

    Object.entries(dataToExport).forEach(([tableName, data]) => {

      if (data && data.length > 0) {
        
        let sheetName;
        // Map internal table names to more readable sheet names
        switch(tableName) {
            case 'empty_bottle_stock':
                sheetName = 'Stok Kemasan Returnable';
                break;
            case 'stock_movements':
                sheetName = 'Pergerakan Stok';
                break;
            default:
                sheetName = tableName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), sheetName);

      }

    });



    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const blob = new Blob([wbout], { type: 'application/octet-stream' });

    const companyNameForFile = companies.find(c => c.id === activeTab)?.name || 'Data';

    saveAs(blob, `Data_Export_${companyNameForFile}_${new Date().toLocaleDateString('id-ID')}.xlsx`);

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
  
  const filteredTables = (processedData[activeTab] && Object.keys(processedData[activeTab]).length > 0)
    ? Object.keys(processedData[activeTab]).map(key => {
        let name = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (key === 'empty_bottle_stock') name = 'Stok Kemasan Returnable';
        if (key === 'products') name = 'Produk';
        if (key === 'stock_movements') name = 'Pergerakan Stok';
        
        return {
          name,
          data: processedData[activeTab][key] || [],
          fileName: key
        };
      })
    : [];

  const tables = [
    ...(userProfile?.role === 'super_admin' ? [{ name: 'Perusahaan', data: processedData[activeTab]?.companies, fileName: 'companies' }] : []),
    { name: 'Pelanggan', data: processedData[activeTab]?.customers, fileName: 'customers' },
    { name: 'Produk', data: processedData[activeTab]?.products, fileName: 'products' },
    { name: 'Stok Kemasan Returnable', data: processedData[activeTab]?.empty_bottle_stock, fileName: 'empty_bottle_stock' },
    { name: 'Pesanan', data: processedData[activeTab]?.orders, fileName: 'orders' },
    { name: 'Order Pusat', data: processedData[activeTab]?.central_orders, fileName: 'central_orders' },
    { name: 'Laporan Pengeluaran', data: processedData[activeTab]?.expense_reports, fileName: 'expense_reports' },
    { name: 'Transaksi Keuangan', data: processedData[activeTab]?.financial_transactions, fileName: 'financial_transactions' },
    { name: 'Invoices', data: processedData[activeTab]?.invoices, fileName: 'invoices' },
    { name: 'Pembayaran', data: processedData[activeTab]?.payments, fileName: 'payments' },
    { name: 'Pergerakan Stok', data: processedData[activeTab]?.stock_movements, fileName: 'stock_movements' },
    { name: 'Profil Pengguna', data: processedData[activeTab]?.profiles, fileName: 'profiles' },
    { name: 'Metode Pembayaran', data: processedData[activeTab]?.payment_methods, fileName: 'payment_methods' },
    { name: 'Kategori', data: processedData[activeTab]?.categories, fileName: 'categories' },
    { name: 'Sub Kategori', data: processedData[activeTab]?.subcategories, fileName: 'subcategories' },
    { name: 'Pemasok', data: processedData[activeTab]?.suppliers, fileName: 'suppliers' },
  ];
  
  return (

    <div className="container mx-auto p-4 md:p-8">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">

        <h1 className="text-3xl font-bold flex items-center gap-3">

          <Database className="h-8 w-8" />

          Data Center

        </h1>

        <Button onClick={exportAllToExcel} className="flex items-center gap-2 w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90">

            <Download className="h-4 w-4" /> Export All to Excel

        </Button>

      </div>
      
      <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="text"
            placeholder="Cari data di semua tabel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10"
          />
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
                      <div className="overflow-x-auto overflow-y-auto rounded-md border max-h-[400px]">
                        <Table className="table-auto min-w-max">
                          <TableHeader>
                            <TableRow>
                              {Object.keys(table.data[0]).map(key => (
                                <TableHead key={key} className="whitespace-nowrap">{key}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {table.data
                              .filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(searchQuery.toLowerCase())))
                              .map((row, index) => (
                                <TableRow key={index}>
                                  {Object.values(row).map((value, idx) => (
                                    <TableCell key={idx} className="whitespace-nowrap max-w-xs truncate">
                                      {value?.toString() || '-'}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            {table.data.length > 0 && table.data.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={Object.keys(table.data[0]).length} className="text-center text-muted-foreground py-8">
                                        Tidak ada data yang cocok dengan pencarian Anda.
                                    </TableCell>
                                </TableRow>
                            )}
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value={activeTab} className="space-y-8 mt-6">
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
                    <div className="overflow-x-auto overflow-y-auto rounded-md border max-h-[400px] scrollbar-hide">
                      <Table className="table-auto min-w-max">
                        <TableHeader>
                          <TableRow>
                            {Object.keys(table.data[0]).map(key => (
                              <TableHead key={key} className="whitespace-nowrap">{key}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {table.data
                            .filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(searchQuery.toLowerCase())))
                            .map((row, index) => (
                              <TableRow key={index}>
                                {Object.values(row).map((value, idx) => (
                                  <TableCell key={idx} className="whitespace-nowrap max-w-xs truncate">
                                    {value?.toString() || '-'}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          {table.data.length > 0 && table.data.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 && (
                              <TableRow>
                                  <TableCell colSpan={Object.keys(table.data[0]).length} className="text-center text-muted-foreground py-8">
                                      Tidak ada data yang cocok dengan pencarian Anda.
                                  </TableCell>
                              </TableRow>
                          )}
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
        </Tabs>
      )}
    </div>
  );
};

export default DataExportPage;