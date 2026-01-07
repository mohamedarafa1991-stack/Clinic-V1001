import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { dbService } from '../services/db';
import { hashPassword } from '../utils/security';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider = ({ children }: { children?: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('medicore_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const login = async (email: string, pass: string) => {
    try {
        // 1. Fetch user by email
        const users = dbService.query("SELECT * FROM users WHERE email = ?", [email]);
        if (users.length === 0) return false;

        const u = users[0] as User & { password: string };
        const inputHash = await hashPassword(pass);

        // 2. Check Hash Match (Secure)
        if (u.password === inputHash) {
            finishLogin(u);
            return true;
        }

        // 3. Legacy Fallback (Migration)
        // If stored password is not hashed (assuming simple check, or just equality), update it.
        // In a real app, we'd check if u.password looks like a hash. Here we check direct equality.
        if (u.password === pass) {
            console.log("Migrating legacy password for user:", u.id);
            dbService.exec("UPDATE users SET password = ? WHERE id = ?", [inputHash, u.id]);
            finishLogin(u);
            return true;
        }

        return false;
    } catch (e) {
        console.error("Login error", e);
        return false;
    }
  };

  const finishLogin = (u: User) => {
      const safeUser = { ...u }; 
      // @ts-ignore
      delete safeUser.password;
      
      setUser(safeUser);
      localStorage.setItem('medicore_user', JSON.stringify(safeUser));
      dbService.logAudit(u.id, 'LOGIN', 'User logged in successfully');
  };

  const logout = () => {
    if (user) dbService.logAudit(user.id, 'LOGOUT', 'User logged out');
    setUser(null);
    localStorage.removeItem('medicore_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
