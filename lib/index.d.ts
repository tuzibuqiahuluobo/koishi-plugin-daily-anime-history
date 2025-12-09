import { Context, Schema } from 'koishi';
export declare const name = "daily-anime-history";
export declare const inject: string[];
export interface Config {
    scheduleType: 'preset' | 'custom';
    hour: number;
    minute: number;
    cron: string;
    targetGroups: string[];
    outputMode: 'image' | 'text' | 'url';
    compressBackground: boolean;
    apiUrl: {
        history: string;
        holiday: string;
        image: string;
    };
    imageStyle: {
        width: number;
        height: number;
        overlayOpacity: number;
        blur: number;
        quality: number;
        backgroundPosition: string;
    };
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
