import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LoginForm from '@/components/Auth/LoginForm';

const AuthPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Login</CardTitle>
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
