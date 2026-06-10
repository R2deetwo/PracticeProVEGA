
import { Task, TaskStatus } from '../types';

export const getEventTypeColorClass = (color: string) => {
    switch (color) {
        case 'red': return 'bg-red-500';
        case 'orange': return 'bg-orange-500';
        case 'yellow': return 'bg-yellow-500';
        case 'green': return 'bg-green-500';
        case 'blue': return 'bg-blue-500';
        case 'purple': return 'bg-purple-500';
        case 'pink': return 'bg-pink-500';
        case 'indigo': return 'bg-indigo-500';
        default: return 'bg-gray-500';
    }
};

export const getBorderColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
        red: 'border-red-400',
        orange: 'border-orange-400',
        yellow: 'border-yellow-400',
        green: 'border-green-400',
        blue: 'border-blue-400',
        purple: 'border-purple-400',
        pink: 'border-pink-400',
        indigo: 'border-indigo-400',
    };
    return colorMap[color] || 'border-gray-400';
};


export const getEventTypeBadgeClass = (color: string, type: 'badge' | 'bg-opacity-20' | 'bg' | 'calendar-tile' = 'badge') => {
    switch (type) {
        case 'calendar-tile':
            // Pastel backgrounds, stronger text, solid left border
            switch (color) {
                case 'red': return 'bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100 border-l-red-500';
                case 'orange': return 'bg-orange-100 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100 border-l-orange-500';
                case 'yellow': return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 border-l-yellow-500';
                case 'green': return 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 border-l-green-500';
                case 'blue': return 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-l-blue-500';
                case 'purple': return 'bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100 border-l-purple-500';
                case 'pink': return 'bg-pink-100 dark:bg-pink-900/40 text-pink-900 dark:text-pink-100 border-l-pink-500';
                case 'indigo': return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-100 border-l-indigo-500';
                default: return 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-l-gray-500';
            }
        case 'bg-opacity-20':
            switch (color) {
                case 'red': return 'bg-red-500/20 dark:bg-red-500/30';
                case 'orange': return 'bg-orange-500/20 dark:bg-orange-500/30';
                case 'yellow': return 'bg-yellow-500/20 dark:bg-yellow-500/30';
                case 'green': return 'bg-green-500/20 dark:bg-green-500/30';
                case 'blue': return 'bg-blue-500/20 dark:bg-blue-500/30';
                case 'purple': return 'bg-purple-500/20 dark:bg-purple-500/30';
                case 'pink': return 'bg-pink-500/20 dark:bg-pink-500/30';
                case 'indigo': return 'bg-indigo-500/20 dark:bg-indigo-500/30';
                default: return 'bg-gray-500/20 dark:bg-gray-500/30';
            }
        case 'bg':
            switch (color) {
                case 'red': return 'bg-red-500';
                case 'orange': return 'bg-orange-500';
                case 'yellow': return 'bg-yellow-500';
                case 'green': return 'bg-green-500';
                case 'blue': return 'bg-blue-500';
                case 'purple': return 'bg-purple-500';
                case 'pink': return 'bg-pink-500';
                case 'indigo': return 'bg-indigo-500';
                default: return 'bg-gray-500';
            }
        default: // badge
            switch (color) {
                case 'red': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
                case 'orange': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
                case 'yellow': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
                case 'green': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
                case 'blue': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
                case 'purple': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
                case 'pink': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
                case 'indigo': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
                default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            }
    }
};

export const formatDueDate = (dueDateString: string | null): string => {
    if (!dueDateString) {
        return '';
    }

    const dueDate = new Date(dueDateString);
    if (isNaN(dueDate.getTime())) {
        return 'Invalid date';
    }
    const today = new Date();

    // Reset time to 00:00:00 for accurate day difference calculation
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return "Due today";
    } else if (diffDays === 1) {
        return "Due tomorrow";
    } else if (diffDays > 1) {
        return `Due in ${diffDays} days`;
    } else if (diffDays === -1) {
        return "Overdue by 1 day";
    } else {
        return `Overdue by ${Math.abs(diffDays)} days`;
    }
};

export const getDueDateColor = (dueDateString: string | null | undefined): string => {
    if (!dueDateString) {
        return 'text-gray-500 dark:text-gray-400';
    }
    const dueDate = new Date(dueDateString);
    if (isNaN(dueDate.getTime())) {
        return 'text-red-600 dark:text-red-500 font-semibold';
    }
    const today = new Date();
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) { // Overdue
        return 'text-red-600 dark:text-red-500 font-semibold';
    } else if (diffDays <= 3) { // Due soon
        return 'text-yellow-600 dark:text-yellow-500 font-semibold';
    } else { // Due later
        return 'text-gray-500 dark:text-gray-400';
    }
}

export const getDueDateBorderColor = (dueDateString: string | null | undefined): string => {
    if (!dueDateString) {
        return 'border-gray-300 dark:border-slate-600';
    }
    const dueDate = new Date(dueDateString);
    if (isNaN(dueDate.getTime())) {
        return 'border-red-500';
    }
    const today = new Date();
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) { // Overdue
        return 'border-red-500';
    } else if (diffDays <= 3) { // Due soon
        return 'border-yellow-500';
    } else { // Due later
        return 'border-gray-300 dark:border-slate-600';
    }
};

export const getHighlightColorForTask = (task: Task): 'red' | 'orange' | 'blue' => {
    if (!task.dueDate || task.status === 'done') {
        return 'blue';
    }

    const dueDate = new Date(task.dueDate);
    const today = new Date();
    // Reset time for accurate day difference
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return 'red'; // Overdue
    } else if (diffDays <= 3) {
        return 'orange'; // Due soon
    } else {
        return 'blue'; // Due later
    }
};

export const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const cleanedName = name.replace(/[,.]/g, '');
    const names = cleanedName.split(' ').filter(Boolean);
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    if (names.length === 1 && names[0].length > 1) {
        return names[0].substring(0, 2).toUpperCase();
    }
    if (names.length === 1) {
        return names[0].toUpperCase();
    }
    return '?';
};

const colors = [
    'bg-red-700', 'bg-orange-800', 'bg-amber-800', 'bg-lime-800',
    'bg-green-800', 'bg-emerald-800', 'bg-teal-800', 'bg-cyan-800',
    'bg-sky-700', 'bg-blue-700', 'bg-indigo-700', 'bg-violet-700',
    'bg-purple-700', 'bg-fuchsia-800', 'bg-pink-700', 'bg-rose-700'
];

export const getUserColor = (name: string | null | undefined): string => {
    let hash = 0;
    if (!name || name.length === 0) return colors[0];
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
};

export const timeAgo = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';

    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.round(hours / 24);
    return `${days}d ago`;
};
