import React, { useState, useEffect } from 'react';
import { CustomEventType } from '../../types';
import { PALETTE_COLORS } from '../../constants';
import { getEventTypeBadgeClass } from '../../utils/colorUtils';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { Button, Input } from '../ui';

interface EventTypeFormProps {
  onAddEventType?: (newEventType: Omit<CustomEventType, 'id'>) => void;
  onUpdateEventType?: (updatedEventType: CustomEventType) => void;
  onDelete?: () => void;
  onClose: () => void;
  eventTypeToEdit?: CustomEventType;
}

/**
 * Chunk-A primitive adoption (second pilot, ADR-0004). Same flagged
 * normalizations as BankAccountForm: Cancel -> standard secondary (was
 * bg-slate-200 with a duplicated dark:hover), Delete -> danger-soft
 * (verbatim pattern match), labels dark:text-dim-300 -> zinc-300.
 * The color swatch buttons stay hand-rolled — they are color chips, not
 * action buttons (no Button variant should be).
 */
const EventTypeForm: React.FC<EventTypeFormProps> = ({ onAddEventType, onUpdateEventType, onDelete, onClose, eventTypeToEdit }) => {
  const { coreState } = useCoreState();
  const { addToast } = useUI();
    const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE_COLORS[0]);

  const isEditing = !!eventTypeToEdit;

  useEffect(() => {
    if (isEditing && eventTypeToEdit) {
      setName(eventTypeToEdit.name);
      setColor(eventTypeToEdit.color);
    }
  }, [isEditing, eventTypeToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Please provide a name for the event type.", { type: 'error' });
      return;
    }

    if (isEditing && onUpdateEventType && eventTypeToEdit) {
      /* Added firmId to satisfy CustomEventType interface */
      const eventTypeData: CustomEventType = {
          id: eventTypeToEdit.id,
          firmId: coreState.firmDetails.id,
          name: name.trim(),
          color,
      };
      await onUpdateEventType(eventTypeData);
    } else if (onAddEventType) {
      /* Added firmId to satisfy Omit<CustomEventType, "id"> interface */
      const eventTypeData: Omit<CustomEventType, 'id'> = {
          firmId: coreState.firmDetails.id,
          name: name.trim(),
          color,
      };
      await onAddEventType(eventTypeData);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label="Event Type Name"
        id="eventTypeName"
        styleVariant="classic"
        autoComplete="off"
        data-lpignore="true"
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g., Deposition"
        required
      />

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-dim-300 mb-1">Color</label>
        <div className="flex flex-wrap gap-2 p-2 bg-slate-100 dark:bg-dim-700 rounded-lg">
            {PALETTE_COLORS.map(c => (
                <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all duration-150 ${getEventTypeBadgeClass(c, 'bg')} ${color === c ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-dim-800' : ''}`}
                    aria-label={`Select ${c} color`}
                />
            ))}
        </div>
      </div>

      <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="w-full sm:w-auto">
          {isEditing && onDelete && (
            <Button variant="danger-soft" onClick={onDelete} className="w-full sm:w-auto">
              Delete
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
            <Button type="submit" className="w-full sm:w-auto">{isEditing ? 'Save Changes' : 'Create Event Type'}</Button>
        </div>
      </div>
    </form>
  );
};

export default EventTypeForm;
