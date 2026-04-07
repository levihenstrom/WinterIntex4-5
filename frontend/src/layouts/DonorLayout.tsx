import { Outlet } from 'react-router-dom';
import NavBar from '../components/hw/NavBar';

export default function DonorLayout() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <NavBar />
      <div className="hw-auth-page-content flex-grow-1">
        <main className="flex-grow-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
