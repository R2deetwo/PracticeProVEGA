
import React from 'react';
import MiniCalendar from '../MiniCalendar';
import { CalendarEvent, CustomEventType } from '../../types';

interface CalendarWidgetProps {
    events: CalendarEvent[];
    eventTypes: CustomEventType[];
    onEventSelect: (eventId: string, date: string) => void;
    onViewFullCalendar: (date: string) => void;
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ events, eventTypes, onEventSelect, onViewFullCalendar }) => {
    return (
        <div className="h-full w-full">
             <MiniCalendar 
                events={events} 
                eventTypes={eventTypes} 
                onEventSelect={onEventSelect}
                onViewFullCalendar={onViewFullCalendar}
             />
        </div>
    );
};

export default CalendarWidget;
