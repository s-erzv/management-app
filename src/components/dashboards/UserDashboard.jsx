import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon } from 'lucide-react';

const UserDashboard = ({ profile, data }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Daftar Tugas Anda</h2>
      <p className="text-gray-600">Halo, {profile.full_name}! Berikut adalah tugas pengantaran Anda hari ini.</p>
      <Card>
        <CardHeader><CardTitle>Tugas Pengantaran Hari Ini</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold">{data.tasksToday}</p></CardContent>
      </Card>
      <Alert>
        <RocketIcon className="h-4 w-4" />
        <AlertTitle>Fokus pada Tugas</AlertTitle>
        <AlertDescription>
          Akses Anda terbatas pada tugas pengantaran yang diberikan.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default UserDashboard;