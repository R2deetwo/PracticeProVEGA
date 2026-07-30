import React, { useState, useEffect } from 'react';
import { CustomEventType } from '../../types';
import { PALETTE_COLORS } from '../../constants';
import { inputClassic } from '../../utils/formStyles';
import { getEventTypeBadgeClass } from '../../utils/colorUtils';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';

interface EventTypeFormProps {
  onAddEventType?: (newEventType: Omit<CustomEventType, 'id'>) => void;
  onUpdateEventType?: (updatedEventType: CustomEventType) => void;
  onDelete?: () => void;
  onClose: () => void;
  eventTypeToEdit?: CustomEventType;
}

const EventTypeForm: React.FC<EventTypeFormProps> = ({ onAddEventType, onUpdateEventType, onDelete, onClose, eventTypeToEdit }) => {
  const { coreState, isDataLoaded } = useCoreState();
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

    const commonInputClass = inputClassic;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="eventTypeName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type Name</label>
        <input autoComplete="off" data-lpignore="true"  type="text" id="eventTypeName" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Deposition" className={commonInputClass} required />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
        <div className="flex flex-wrap gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            {PALETTE_COLORS.map(c => (
                <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all duration-150 ${getEventTypeBadgeClass(c, 'bg')} ${color === c ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800' : ''}`}
                    aria-label={`Select ${c} color`}
                />
            ))}
        </div>
      </div>

      <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="w-full sm:w-auto">
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-full sm:w-auto px-4 py-2 bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-900/50 dark:text-red-300 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/80 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2 bg-gray-200 dark:bg-zinc-800 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-zinc-700 dark:hover:bg-gray-500 transition-colors">Cancel</button>
            <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">{isEditing ? 'Save Changes' : 'Create Event Type'}</button>
        </div>
      </div>
    </form>
  );
};

export default EventTypeForm;
