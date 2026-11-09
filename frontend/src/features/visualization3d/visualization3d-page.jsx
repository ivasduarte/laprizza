import { useTranslation } from 'react-i18next';
import KitchenViewer from '../kitchen-configuration/kitchen-viewer.jsx';

export default function Visualization3dPage() {
    const { t } = useTranslation();

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          height: '100%',
        }}
      >
        <h1>{t('nav.visualization3d')}</h1>

        {/* The viewer loads the data and displays the 3D engine within the SPA layout */}
        <KitchenViewer />
      </div>
    );
}