/**
 * ColumnControls.jsx
 * Which columns the analysis table shows: the standard set, presets, and every column by group.
 */

import { useState, useEffect } from 'preact/hooks';
import { Button } from '../../../../components/Button.jsx';
import { Checkbox, Select } from '../../../../components/Field.jsx';
import { Icon } from '../../../../components/Icon.jsx';
import { Cell } from '../../../../components/Tile.jsx';
import {
  ANALYZER_DB_KEYS,
  groups,
  getGroupedColumns,
  getDefaultColumns,
  getAllColumns,
  getColumnsByGroup,
  saveToStorage,
  loadFromStorage,
} from '../../utils/analyzerUtils';
import { IconButton } from '../../ui/IconButton.jsx';
import { getAnalyzerGroupCardVisuals } from './analyzerGroupVisuals';

const BUILT_IN_PRESET_IDS = {
  ALL_METRICS: 'ALL_METRICS',
  SYSTEM_INFO: 'SYSTEM_INFO',
};

export function ColumnControls({ activeColumns, onColumnsChange, headerChildren = null }) {
  const [expanded, setExpanded] = useState(false);
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');

  // Load custom presets on mount
  useEffect(() => {
    setPresets(loadFromStorage(ANALYZER_DB_KEYS.PRESETS, []));
  }, []);

  const groupedColumns = getGroupedColumns();

  /**
   * Toggle individual column visibility
   */
  const toggleColumn = (columnId, checked) => {
    const newColumns = new Set(activeColumns);
    checked ? newColumns.add(columnId) : newColumns.delete(columnId);
    onColumnsChange(newColumns);

    // Reset preset selection if manual changes are made
    if (selectedPresetId) setSelectedPresetId('');
  };

  // --- Action Handlers ---

  const applyStandard = e => {
    e.stopPropagation(); // Prevent closing if called from header
    const userStandard = loadFromStorage(ANALYZER_DB_KEYS.USER_STANDARD);
    onColumnsChange(userStandard ? new Set(userStandard) : getDefaultColumns());
    setSelectedPresetId('');
  };

  const applyAll = () => {
    onColumnsChange(getAllColumns());
    setSelectedPresetId(BUILT_IN_PRESET_IDS.ALL_METRICS);
  };

  const applySystemInfo = () => {
    onColumnsChange(getColumnsByGroup('system'));
    setSelectedPresetId(BUILT_IN_PRESET_IDS.SYSTEM_INFO);
  };

  const applyFactoryReset = () => {
    if (confirm('Reset columns to system defaults?')) {
      onColumnsChange(getDefaultColumns());
      setSelectedPresetId('');
    }
  };

  const saveAsStandard = () => {
    if (!confirm("Save current selection as your new 'Standard'?")) return;
    saveToStorage(ANALYZER_DB_KEYS.USER_STANDARD, Array.from(activeColumns));
  };

  const saveAsPreset = () => {
    const name = prompt('Name for new Preset:');
    if (!name) return;
    const newPreset = { id: Date.now().toString(), name, columns: Array.from(activeColumns) };
    const updated = [...presets, newPreset];
    setPresets(updated);
    saveToStorage(ANALYZER_DB_KEYS.PRESETS, updated);
    setSelectedPresetId(newPreset.id);
  };

  const deletePreset = e => {
    e.stopPropagation();
    if (!selectedPresetId || Object.values(BUILT_IN_PRESET_IDS).includes(selectedPresetId)) return;
    if (!confirm('Delete this preset?')) return;
    const updated = presets.filter(p => p.id !== selectedPresetId);
    setPresets(updated);
    saveToStorage(ANALYZER_DB_KEYS.PRESETS, updated);
    applyStandard(e); // Reset to standard after delete
  };

  /**
   * Helper to format detailed technical labels
   */
  const getDetailedLabel = col => {
    let suffix = '';
    if (col.type === 'se') suffix = ' start/end';
    else if (col.type === 'mm') suffix = ' min/max';
    else if (col.type === 'avg') suffix = ' average';
    return col.label + suffix;
  };

  const handleHeaderToggle = () => {
    setExpanded(prev => !prev);
  };

  const collapseControls = () => {
    setExpanded(false);
  };

  const isCustomPreset =
    selectedPresetId && !Object.values(BUILT_IN_PRESET_IDS).includes(selectedPresetId);

  return (
    <div className='flex flex-col gap-3' data-analysis-columns>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <Button
            size='sm'
            variant={expanded ? 'ink' : undefined}
            aria-expanded={expanded}
            onClick={handleHeaderToggle}
            title={expanded ? 'Collapse column settings' : 'Expand column settings'}
          >
            <Icon name='sliders-horizontal' size={18} />
            Columns
          </Button>

          <Button size='sm' className='max-sm:hidden' onClick={applyStandard}>
            Standard
          </Button>

          <Select
            className='an-input--sm an-table__preset'
            aria-label='Column preset'
            value={selectedPresetId}
            onChange={e => {
              const val = e.target.value;
              if (val === BUILT_IN_PRESET_IDS.ALL_METRICS) {
                applyAll();
              } else if (val === BUILT_IN_PRESET_IDS.SYSTEM_INFO) {
                applySystemInfo();
              } else {
                const p = presets.find(x => x.id === val);
                if (p) {
                  onColumnsChange(new Set(p.columns));
                  setSelectedPresetId(p.id);
                }
              }
            }}
          >
            <option value='' disabled>
              Presets
            </option>
            <option value={BUILT_IN_PRESET_IDS.ALL_METRICS}>All metrics</option>
            <option value={BUILT_IN_PRESET_IDS.SYSTEM_INFO}>System info</option>
            {presets.length > 0 && <option disabled>──────────</option>}
            {presets.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          {isCustomPreset && (
            <IconButton icon='trash-2' label='Delete preset' onClick={deletePreset} />
          )}
        </div>

        {headerChildren}
      </div>

      {expanded && (
        <div className='an-cols flex flex-col gap-3'>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4'>
            {Object.keys(groupedColumns).map(groupKey => {
              const cols = groupedColumns[groupKey];
              const groupVisuals = getAnalyzerGroupCardVisuals(groupKey);

              return (
                <Cell key={groupKey} className='gap-1'>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='bm-eyebrow'>{groups[groupKey]}</span>
                    <span className='flex shrink-0 items-center gap-1'>
                      {groupVisuals.map((groupVisual, index) => (
                        <Icon
                          key={`${groupKey}-${index}`}
                          name={groupVisual.icon}
                          size={18}
                          style={{ color: groupVisual.color }}
                        />
                      ))}
                    </span>
                  </div>
                  {cols.map(col => (
                    <Checkbox
                      key={col.id}
                      checked={activeColumns.has(col.id)}
                      onChange={e => toggleColumn(col.id, e.target.checked)}
                    >
                      {getDetailedLabel(col)}
                    </Checkbox>
                  ))}
                </Cell>
              );
            })}
          </div>

          <div className='flex flex-wrap items-center justify-between gap-2'>
            <Button size='sm' variant='danger' onClick={applyFactoryReset}>
              <Icon name='refresh-cw' size={18} />
              Reset defaults
            </Button>
            <div className='flex flex-wrap items-center gap-2'>
              <Button size='sm' onClick={saveAsStandard}>
                Save as standard
              </Button>
              <Button size='sm' onClick={saveAsPreset}>
                Save as preset
              </Button>
              <Button size='sm' variant='ink' onClick={collapseControls}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
