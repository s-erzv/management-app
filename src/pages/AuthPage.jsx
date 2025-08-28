import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LoginForm from '@/components/Auth/LoginForm';
import SignUpForm from '@/components/Auth/SignUpFrom';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {isLogin ? 'Login' : 'Registrasi'}
          </CardTitle>
          <CardDescription className="text-center">
            Akses Dashboard Distribusi Galon
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLogin ? <LoginForm /> : <SignUpForm />}
          <p className="mt-4 text-sm text-center">
            {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-500 hover:underline ml-1"
            >
              {isLogin ? 'Daftar sekarang' : 'Login'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;