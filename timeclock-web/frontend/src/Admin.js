import React from 'react';
import { ThemeProvider } from 'styled-components';
import theme from './theme';
import GlobalStyles from './GlobalStyles';
import Layout from './components/Layout';
import AdminLinks from './components/AdminLinks';

function Admin() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <Layout>
        <h1 style={{ textAlign: 'center', marginBottom: '1rem' }}>Admin Dashboard</h1>
        <AdminLinks />
      </Layout>
    </ThemeProvider>
  );
}

export default Admin; 