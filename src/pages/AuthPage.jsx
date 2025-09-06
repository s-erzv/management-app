import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LoginForm from '@/components/Auth/LoginForm';
import { UserCircle2 } from 'lucide-react';

const AuthPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <Card className="w-full max-w-sm sm:max-w-md border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl text-center text-[#10182b] flex items-center justify-center gap-3">
            <UserCircle2 className="h-8 w-8" />
            Login
          </CardTitle>
          <CardDescription className="text-center">
            Akses Dashboard Distribusi Galon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-4 text-xs text-center text-muted-foreground">
            Akun dibuat oleh admin. Hubungi admin jika butuh akses atau reset sandi.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;