import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Eye, EyeSlash } from '@phosphor-icons/react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left side - Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1694702722584-05adc8802e28?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBkYXJrJTIwYnVpbGRpbmclMjBleHRlcmlvcnxlbnwwfHx8fDE3NzU2NjYzMTV8MA&ixlib=rb-4.1.0&q=85')`
        }}
      >
        <div className="absolute inset-0 bg-black/80" />
        <div className="relative z-10 flex flex-col justify-center px-12">
          <h1 className="text-4xl font-semibold text-white mb-4 font-['Outfit']">
            CIPOLATTI
          </h1>
          <p className="text-gray-400 text-lg max-w-md">
            Sistema de gerenciamento de portaria para registro e controle de visitantes, frota, funcionários e diretoria.
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_portaria-acesso/artifacts/cligmmqg_icone%20cipo.png" 
              alt="CIPOLATTI" 
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <h2 className="text-2xl font-semibold text-white font-['Outfit']">CIPOLATTI</h2>
              <p className="text-sm text-gray-500">Sistema de Controle de Acesso</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-400">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#0A0A0A] border-[#262626] text-white focus:border-[#3B82F6] focus:ring-[#3B82F6]"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-400">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  data-testid="login-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#0A0A0A] border-[#262626] text-white focus:border-[#3B82F6] focus:ring-[#3B82F6] pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-md text-sm" data-testid="login-error">
                {error}
              </div>
            )}

            <Button
              type="submit"
              data-testid="login-submit-button"
              disabled={isLoading}
              className="w-full bg-white text-black hover:bg-gray-200 font-medium"
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Acesso restrito a funcionários autorizados
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
