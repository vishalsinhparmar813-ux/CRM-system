import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'simplebar-react/dist/simplebar.min.css';
import 'flatpickr/dist/themes/light.css';
import '../src/assets/scss/app.scss';
import { BrowserRouter } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import { Provider } from 'react-redux';
import store from './store';
import 'react-toastify/dist/ReactToastify.css';
import AdminContextProvider from './context/useAdmin';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <BrowserRouter>
      <Provider store={store}>
        <AdminContextProvider>
          <App />
        </AdminContextProvider>
      </Provider>
    </BrowserRouter>
  </>
);
