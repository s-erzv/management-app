// src/pages/CalendarPage.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, ListOrdered } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

const getStatusColor = (status) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'sent':
      return 'bg-yellow-100 text-yellow-800';
    case 'draft':
      return 'bg-gray-200 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const CalendarPage = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ordersByDate, setOrdersByDate] = useState({});

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  useEffect(() => {
    if (companyId) {
      fetchOrders(currentDate);
    }
  }, [companyId, currentDate]);

  const fetchOrders = async (date) => {
    setLoading(true);
    const startDate = startOfMonth(date);
    const endDate = endOfMonth(date);

    const { data, error } = await supabase
      .from('orders')
      .select('planned_date, status, customers(name)')
      .eq('company_id', companyId)
      .gte('planned_date', format(startDate, 'yyyy-MM-dd'))
      .lte('planned_date', format(endDate, 'yyyy-MM-dd'));

    if (error) {
      console.error('Error fetching orders:', error);
      toast.error('Gagal memuat data pesanan untuk kalender.');
      setOrdersByDate({});
      setLoading(false);
      return;
    }

    const groupedOrders = data.reduce((acc, order) => {
      const dateString = format(new Date(order.planned_date), 'yyyy-MM-dd');
      if (!acc[dateString]) {
        acc[dateString] = [];
      }
      acc[dateString].push({
        customerName: order.customers?.name,
        status: order.status,
      });
      return acc;
    }, {});
    setOrdersByDate(groupedOrders);
    setLoading(false);
  };

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const today = new Date();

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
          <CalendarIcon className="h-8 w-8" />
          Kalender Pesanan
        </h1>
        <Button onClick={() => handleToday()} variant="outline">Hari Ini</Button>
      </div>

      <Card className="border-0 shadow-lg bg-white">
        <CardHeader className="p-4 sm:p-6 flex-row items-center justify-between border-b">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <CardTitle className="text-xl font-semibold text-[#10182b]">
            {format(currentDate, 'MMMM yyyy', { locale: id })}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-7 text-center text-sm font-medium text-gray-500 border-b">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
              <div key={day} className="py-2">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {daysInMonth.map((day, index) => {
              const dayString = format(day, 'yyyy-MM-dd');
              const dayOrders = ordersByDate[dayString] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, today);

              return (
                <div 
                  key={index} 
                  className={`
                    h-40 p-1 border 
                    ${isCurrentMonth ? '' : 'text-gray-400 bg-gray-50'}
                    ${isToday ? 'bg-blue-100 border-blue-400' : ''}
                  `}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-[calc(100%-24px)] scrollbar-hide">
                    {loading ? (
                      <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      dayOrders.map((order, idx) => (
                        <div key={idx} className={`text-xs p-1 rounded-sm ${getStatusColor(order.status)}`}>
                          {order.customerName}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Legend */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-[#10182b]">Keterangan Status</h2>
        <div className="flex flex-wrap gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-gray-200 rounded-sm"></div>
            <span className="text-sm">Menunggu (Draft)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-yellow-100 rounded-sm"></div>
            <span className="text-sm">Dikirim (Sent)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-green-100 rounded-sm"></div>
            <span className="text-sm">Selesai (Completed)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;