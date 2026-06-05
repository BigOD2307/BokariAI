import academicSearchAction from './academicSearch';
import discoverSearchAction from './discoverSearch';
import doneAction from './done';
import planAction from './plan';
import ActionRegistry from './registry';
import scrapeURLAction from './scrapeURL';
import socialSearchAction from './socialSearch';
import uploadsSearchAction from './uploadsSearch';
import webSearchAction from './webSearch';
import youtubeSearchAction from './youtubeSearch';
import youtubeComprehendAction from './youtubeComprehend';

ActionRegistry.register(webSearchAction);
ActionRegistry.register(doneAction);
ActionRegistry.register(planAction);
ActionRegistry.register(scrapeURLAction);
ActionRegistry.register(uploadsSearchAction);
ActionRegistry.register(academicSearchAction);
ActionRegistry.register(socialSearchAction);
ActionRegistry.register(youtubeSearchAction);
ActionRegistry.register(youtubeComprehendAction);
ActionRegistry.register(discoverSearchAction);

export { ActionRegistry };
