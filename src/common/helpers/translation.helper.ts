import { I18nService } from "nestjs-i18n";

let i18nService: I18nService;
export const setI18nService = (service: I18nService) => {    
    i18nService = service
}

export const __ = (key: string, options?: Record<string, any>): string => {
    let translation = (i18nService.translate(key) as string) || key;
    
    // Replace placeholders if options are provided
    if (options) {
        Object.keys(options).forEach(placeholder => {
            const regex = new RegExp(`{${placeholder}}`, 'g');
            translation = translation.replace(regex, options[placeholder]);
        });
    }
    
    return translation;
}