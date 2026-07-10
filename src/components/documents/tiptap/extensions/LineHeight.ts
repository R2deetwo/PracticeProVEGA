/**
 * LineHeight — adds line-spacing support to paragraphs.
 * Previously the "Single Space" and "Double Space" buttons in the DraftPro
 * ribbon called `updateAttributes('paragraph', { lineHeight })` but the
 * Paragraph extension had no lineHeight attribute → the buttons were a
 * silent no-op. This extension adds the global attribute so the buttons work.
 *
 * Jurisdiction-neutral: no locale-specific formatting logic.
 */
import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        lineHeight: {
            setLineHeight: (height: string) => ReturnType;
            unsetLineHeight: () => ReturnType;
        };
    }
}

export const LineHeight = Extension.create({
    name: 'lineHeight',

    addOptions() {
        return { types: ['paragraph', 'heading'] };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    lineHeight: {
                        default: null,
                        parseHTML: element => element.style.lineHeight || null,
                        renderHTML: attributes => {
                            if (!attributes.lineHeight) return {};
                            return { style: `line-height: ${attributes.lineHeight}` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setLineHeight:
                (height: string) =>
                    ({ commands }: { commands: any }) => {
                        let success = true;
                        this.options.types.forEach((type: string) => {
                            success = commands.updateAttributes(type, { lineHeight: height }) && success;
                        });
                        return success;
                    },
            unsetLineHeight:
                () =>
                    ({ commands }: { commands: any }) => {
                        let success = true;
                        this.options.types.forEach((type: string) => {
                            success = commands.updateAttributes(type, { lineHeight: null }) && success;
                        });
                        return success;
                    },
        };
    },
});
