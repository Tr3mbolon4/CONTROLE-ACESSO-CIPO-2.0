import React, { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { 
  Plus, 
  Pencil, 
  Trash, 
  User,
  ShieldCheck,
  Eye,
  EyeSlash
} from '@phosphor-icons/react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const ROLES = [
  { value: 'portaria', label: 'Portaria' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'dsl', label: 'DSL/Transporte' },
  { value: 'diretoria', label: 'Diretoria' },
  { value: 'admin', label: 'Administrador' },
];

const Settings = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'portaria'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.list();
      setUsers(response.data);
    } catch (error) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedUser) {
        const updateData = {
          name: formData.name,
          email: formData.email,
          role: formData.role
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await usersAPI.update(selectedUser.id, updateData);
        toast.success('Usuário atualizado');
      } else {
        await usersAPI.create(formData);
        toast.success('Usuário criado');
      }
      setDialogOpen(false);
      resetForm();
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar');
    }
  };

  const handleDelete = async () => {
    try {
      await usersAPI.delete(selectedUser.id);
      toast.success('Usuário excluído');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'portaria' });
    setSelectedUser(null);
    setShowPassword(false);
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role
    });
    setDialogOpen(true);
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: 'bg-purple-500/10 border-purple-500 text-purple-500',
      portaria: 'bg-blue-500/10 border-blue-500 text-blue-500',
      gestor: 'bg-green-500/10 border-green-500 text-green-500',
      dsl: 'bg-cyan-500/10 border-cyan-500 text-cyan-500',
      diretoria: 'bg-yellow-500/10 border-yellow-500 text-yellow-500'
    };
    const labels = {
      admin: 'Administrador',
      portaria: 'Portaria',
      gestor: 'Gestor',
      dsl: 'DSL/Transporte',
      diretoria: 'Diretoria'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[role] || colors.portaria}`}>
        {labels[role] || role}
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white font-['Outfit']">Configurações</h1>
          <p className="text-gray-500 mt-1">Gerenciamento de usuários do sistema</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setDialogOpen(true); }}
          className="bg-white text-black hover:bg-gray-200"
          data-testid="add-user-button"
        >
          <Plus size={18} className="mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Users Table */}
      <div className="card-dark overflow-hidden">
        <div className="p-4 border-b border-[#262626]">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <User size={20} weight="duotone" />
            Usuários do Sistema
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-[#262626] hover:bg-transparent">
              <TableHead className="text-gray-400">Nome</TableHead>
              <TableHead className="text-gray-400">Email</TableHead>
              <TableHead className="text-gray-400">Perfil</TableHead>
              <TableHead className="text-gray-400 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                  Nenhum usuário cadastrado
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                  <TableCell className="text-white font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[#262626] rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      {user.name}
                      {user.id === currentUser?.id && (
                        <span className="text-xs text-gray-500">(você)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-400">{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                        className="text-gray-400 hover:text-white"
                        data-testid={`edit-user-${user.id}`}
                      >
                        <Pencil size={16} />
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedUser(user); setDeleteDialogOpen(true); }}
                          className="text-red-400 hover:text-red-300"
                          data-testid={`delete-user-${user.id}`}
                        >
                          <Trash size={16} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Roles Info */}
      <div className="card-dark p-6">
        <h2 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
          <ShieldCheck size={20} weight="duotone" />
          Perfis de Acesso
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-[#0A0A0A] rounded-md">
            <div className="flex items-center gap-2 mb-2">
              {getRoleBadge('portaria')}
            </div>
            <p className="text-sm text-gray-400">
              Cadastrar, editar, visualizar e anexar fotos. Ideal para funcionários da portaria.
            </p>
          </div>
          <div className="p-4 bg-[#0A0A0A] rounded-md">
            <div className="flex items-center gap-2 mb-2">
              {getRoleBadge('gestor')}
            </div>
            <p className="text-sm text-gray-400">
              Visualização total, relatórios completos, filtros avançados e pré-cadastro de agendamentos.
            </p>
          </div>
          <div className="p-4 bg-[#0A0A0A] rounded-md">
            <div className="flex items-center gap-2 mb-2">
              {getRoleBadge('dsl')}
            </div>
            <p className="text-sm text-gray-400">
              Pré-cadastro e agendamento de carregamentos. Ideal para equipe de DSL/Transporte.
            </p>
          </div>
          <div className="p-4 bg-[#0A0A0A] rounded-md">
            <div className="flex items-center gap-2 mb-2">
              {getRoleBadge('diretoria')}
            </div>
            <p className="text-sm text-gray-400">
              Visualização geral, dashboard e relatórios. Acesso focado em visão gerencial.
            </p>
          </div>
          <div className="p-4 bg-[#0A0A0A] rounded-md">
            <div className="flex items-center gap-2 mb-2">
              {getRoleBadge('admin')}
            </div>
            <p className="text-sm text-gray-400">
              Acesso total ao sistema, gerenciamento de usuários e configurações.
            </p>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">
              {selectedUser ? 'Editar Usuário' : 'Novo Usuário'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-gray-400">Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                required
                data-testid="user-name-input"
              />
            </div>
            <div>
              <Label className="text-gray-400">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                required
                data-testid="user-email-input"
              />
            </div>
            <div>
              <Label className="text-gray-400">
                Senha {selectedUser ? '(deixe em branco para manter)' : '*'}
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1 pr-10"
                  required={!selectedUser}
                  data-testid="user-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 mt-0.5"
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Perfil *</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v) => setFormData({ ...formData, role: v })}
              >
                <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white mt-1" data-testid="user-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-[#262626]">
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                className="border-[#262626] text-white hover:bg-[#262626]"
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-white text-black hover:bg-gray-200" data-testid="user-submit-button">
                {selectedUser ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#141414] border-[#262626]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir o usuário "{selectedUser?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#262626] text-white hover:bg-[#262626]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
