import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [boot, setBoot] = useState(null); // {stores, banks, today, settings}
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreIdRaw] = useState(localStorage.getItem("rokadly_store") || "");
  const [date, setDateRaw] = useState("");

  const setStoreId = (v) => {
    setStoreIdRaw(v);
    localStorage.setItem("rokadly_store", v);
  };
  const setDate = (v) => setDateRaw(v);

  const refreshBoot = useCallback(async () => {
    try {
      const { data } = await api.get("/bootstrap");
      setBoot(data);
      setUser(data.user);
      if (!date) setDateRaw(data.today);
      // ensure valid store selection
      const u = data.user;
      if (u.role === "cashier") {
        setStoreIdRaw(u.store_id);
      } else {
        const allowed = u.role === "admin" ? data.stores.map((s) => s.id) : u.store_ids || [];
        const saved = localStorage.getItem("rokadly_store");
        if (saved && allowed.includes(saved)) setStoreIdRaw(saved);
        else if (allowed.length) setStoreIdRaw(allowed[0]);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (localStorage.getItem("rokadly_token")) refreshBoot();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("rokadly_token", data.token);
    await refreshBoot();
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("rokadly_token");
    setUser(null);
    setBoot(null);
    window.location.href = "/login";
  };

  const stores = boot?.stores || [];
  const banks = boot?.banks || [];
  const today = boot?.today || "";
  const storeById = (id) => stores.find((s) => s.id === id);
  const allowedStores =
    user?.role === "admin" ? stores :
    user?.role === "cashier" ? stores.filter((s) => s.id === user.store_id) :
    stores.filter((s) => (user?.store_ids || []).includes(s.id));

  return (
    <AppContext.Provider value={{
      user, boot, loading, login, logout, refreshBoot,
      stores, banks, today, storeId, setStoreId, date, setDate,
      storeById, allowedStores,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
