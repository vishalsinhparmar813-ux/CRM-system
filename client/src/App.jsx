import React, { lazy, Suspense, useContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import Layout from "./layout/Layout";
import Login from "./pages/auth";
import Loading from "./components/Loading.jsx";
import Cookies from "universal-cookie";
import { AdminContext } from "./context/useAdmin.jsx"

// Lazy load components
const Dashboard = lazy(() => import("./pages/dashboard"));
const Clients = lazy(() => import("./pages/dashboard/Clients"));
const FinancialTracking = lazy(() => import("./pages/dashboard/FinancialTracking"));
const Order = lazy(() => import("./pages/orderDetails"));
const SubOrder = lazy(() => import("./pages/subOrder"));
const Invoice = lazy(() => import("./pages/invoice"));
const ProductManagement = lazy(() => import("./pages/product"));
const Error = lazy(() => import("./pages/404"));
const Transactions = lazy(() => import("./pages/dashboard/Transactions"));
const ClientDetails = lazy(() => import("./pages/dashboard/ClientDetails"));
const DebtsList = lazy(() => import("./pages/debts"));
const ProductGroups = lazy(() => import("./pages/productGroups"));
const SubAdminSubOrder = lazy(() => import("./pages/subadmin/SubOrder"));
const SubAdminOrder = lazy(() => import("./pages/subadmin/Order"));
const SubAdminDashboard = lazy(() => import("./pages/subadmin/Dashboard"));
const AdminSubOrder = lazy(() => import("./pages/admin/SubOrder"));

const RootRedirect = () => {
  const { role } = useContext(AdminContext);
  
  if (role === "sub-admin") {
    return <Navigate to="/subadmin" replace />;
  } else {
    return <Navigate to="/dashboard" replace />;
  }
};

const ProtectedRoute = ({ failRedirect, successRedirect, allowedRoles = [], children }) => {
  const cookies = new Cookies();
  const token = cookies.get("auth-token");
  const { role } = useContext(AdminContext);
  const userRole = role;

  // If no token, redirect to login
  if (!token) return <Navigate to={failRedirect || "/login"} />;

  if (allowedRoles.length > 0 && !role) {
    return <Loading />; // wait until role is loaded
  }
  
  // If allowedRoles are specified and user is not allowed
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Redirect based on user role
    if (userRole === "sub-admin") {
      return <Navigate to={successRedirect || "/subadmin"} />;
    } else {
      return <Navigate to={successRedirect || "/dashboard"} />;
    }
  }

  return children;
};

// Simple test component
const TestComponent = () => {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Test Component</h1>
      <p>If you can see this, React is working!</p>
    </div>
  );
};

function App() {
  return (
    <main className="App relative">
      <Routes>
        {/* Root redirect */}
        <Route
          path="/"
          element={
            <ProtectedRoute failRedirect={"/login"}>
              <RootRedirect />
            </ProtectedRoute>
          }
        />

        {/* Login route */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* Test route */}
        <Route
          path="/test"
          element={<TestComponent />}
        />

        {/* Protected layout routes */}
        <Route
          path="/"
          element={
            <Suspense fallback={<Loading />}>
              <ProtectedRoute failRedirect={"/login"}>
                <Layout />
              </ProtectedRoute>
            </Suspense>
          }
        >
          {/* Admin-only routes */}
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Dashboard />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/dashboard/clients"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Clients />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/dashboard/financial"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin"]}>
                  <FinancialTracking />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/product-management"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ProductManagement />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/order"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin", "sub-admin"]}>
                  <Order />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/invoice"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Invoice />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/subOrder"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin", "sub-admin"]}>
                  <SubOrder />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/admin/suborders"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminSubOrder />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/transactions"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Transactions />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/debts"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin"]}>
                  <DebtsList />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/product-groups"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ProductGroups />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/client/:id"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ClientDetails />
                </ProtectedRoute>
              </Suspense>
            }
          />
          {/* Sub-admin only routes */}
          <Route
            path="/subadmin"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["sub-admin"]}>
                  <SubAdminDashboard />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/subadmin/suborders"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["sub-admin"]}>
                  <SubAdminSubOrder />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/subadmin/orders"
            element={
              <Suspense fallback={<Loading />}>
                <ProtectedRoute allowedRoles={["sub-admin"]}>
                  <SubAdminOrder />
                </ProtectedRoute>
              </Suspense>
            }
          />
        </Route>

        {/* 404 route */}
        <Route
          path="/*"
          element={
            <Suspense fallback={<Loading />}>
              <Error />
            </Suspense>
          }
        />
      </Routes>
    </main>
  );
}

export default App;
