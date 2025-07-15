// import { createContext, useState } from 'react';

// export const AdminContext = createContext();

// const AdminContextProvider = ({ children }) => {
//   const [adminDetails, setAdminDetails] = useState();

//   const setAdminData = (data) => {
//     setAdminDetails(data);
//   };

//   return (
//     <AdminContext.Provider
//       value={{
//         adminDetails,
//         setAdminData,
//       }}
//     >
//       {children}
//     </AdminContext.Provider>
//   );
// };
// export default AdminContextProvider;



// context/useAdmin.js

import { createContext, useState, useEffect } from 'react';

export const AdminContext = createContext();

const AdminContextProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  const setAdminData = ({ token, role }) => {
    setToken(token);
    setRole(role);
    sessionStorage.setItem('auth-token', token);
    sessionStorage.setItem('user-role', role);
  };

  const logout = () => {
    setToken(null);
    setRole(null);
    sessionStorage.removeItem('auth-token');
    sessionStorage.removeItem('user-role');
  };

  useEffect(() => {
    // Load from sessionStorage if available
    const savedToken = sessionStorage.getItem('auth-token');
    const savedRole = sessionStorage.getItem('user-role');

    if (savedToken && savedRole) {
      setToken(savedToken);
      setRole(savedRole);
    }
  }, []);

  return (
    <AdminContext.Provider
      value={{
        token,
        role,
        setAdminData,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export default AdminContextProvider;
