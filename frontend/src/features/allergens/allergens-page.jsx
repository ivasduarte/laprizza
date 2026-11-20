import { useTranslation } from 'react-i18next';
import {
  useGetAllergens,
  useGetAllergensId,
} from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import SearchBar from '../../shared/ui/entity/search-bar.jsx';
import { useEntityParams } from '../../shared/ui/entity/use-entity-params.js';
import AllergenDetail from './allergens-detail.jsx';
import AllergenForm from './allergens-form.jsx';
import '../../shared/ui/entity/entity.css';

export default function AllergensPage() {
  const { t } = useTranslation();
  const canWrite = useCan('allergens:write');
  const { q, id, mode, search, view, create, closeForm, close, reset } =
    useEntityParams();

  const list = useGetAllergens(q ? { name: q } : undefined);
  const detail = useGetAllergensId(id, {
    query: { enabled: Boolean(id) && mode !== 'new' },
  });

  const allergens = list.data ?? [];
  const showForm = canWrite && mode === 'new';
  const panelOpen = Boolean(id) || showForm;

  const renderPanel = () => {
    if (showForm) {
      return (
        <AllergenForm
          onSaved={(saved) => view(saved.id)}
          onCancel={closeForm}
        />
      );
    }
    return (
      <QueryState
        query={detail}
        unavailableText={t('allergens.unavailable')}
        unavailable={detail.data?.isActive === false}
        unavailableAction={
          <button type="button" className="secondary small" onClick={reset}>
            {t('entity.backToList')}
          </button>
        }
      >
        {detail.data && (
          <AllergenDetail
            allergen={detail.data}
            onClose={close}
            onDeactivated={reset}
          />
        )}
      </QueryState>
    );
  };

  return (
    <div className="entity-page">
      <header className="entity-header">
        <h1>{t('allergens.title')}</h1>
        {canWrite && !panelOpen && (
          <button type="button" onClick={create}>
            {t('allergens.create')}
          </button>
        )}
      </header>

      {!canWrite && <p className="message">{t('entity.readOnly')}</p>}

      {panelOpen ? (
        renderPanel()
      ) : (
        <>
          <SearchBar
            value={q}
            onSearch={search}
            label={t('allergens.searchLabel')}
            hint={t('allergens.searchHint')}
          />
          <QueryState
            query={list}
            isEmpty={allergens.length === 0}
            searchTerm={q}
            emptyText={t('allergens.empty')}
            noResultsText={t('allergens.noResults', { term: q })}
          >
            <div className="entity-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('allergens.col.name')}</th>
                    <th scope="col">{t('entity.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allergens.map((allergen) => (
                    <tr key={allergen.id}>
                      <td>{allergen.name}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary small"
                          onClick={() => view(allergen.id)}
                          aria-label={`${t('entity.view')}: ${allergen.name}`}
                        >
                          {t('entity.view')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryState>
        </>
      )}
    </div>
  );
}
