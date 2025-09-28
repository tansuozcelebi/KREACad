import { Loc } from '../engine/core/localization.js';
import { AddDiv, AddDomElement } from '../engine/viewer/domutils.js';
import { Embed } from './embed.js';
import { Website } from './website.js';
import { SetEventHandler, HandleEvent } from './eventhandler.js';
import { PluginType, RegisterPlugin } from './pluginregistry.js';
import { ButtonDialog, ProgressDialog } from './dialog.js';
import { ShowMessageDialog } from './dialogs.js';
import { PrimitivesManager } from './primitivesmanager.js';

import * as Engine from '../engine/main.js';
export { Engine };

import './css/icons.css';
import './css/themes.css';
import './css/core.css';
import './css/controls.css';
import './css/dialogs.css';
import './css/treeview.css';
import './css/panelset.css';
import './css/navigator.css';
import './css/sidebar.css';
import './css/website.css';
import './css/embed.css';
import './css/primitives.css';

export const UI = {
    ButtonDialog,
    ProgressDialog,
    ShowMessageDialog,
    HandleEvent,
    Loc
};

export function SetWebsiteEventHandler (eventHandler)
{
    SetEventHandler (eventHandler);
}

export function RegisterHeaderPlugin (plugin)
{
    RegisterPlugin (PluginType.Header, plugin);
}

export function RegisterToolbarPlugin (plugin)
{
    RegisterPlugin (PluginType.Toolbar, plugin);
}

export function StartWebsite ()
{
    window.addEventListener ('load', () => {
        if (window.self !== window.top) {
            let noEmbeddingDiv = AddDiv (document.body, 'noembed');
            AddDiv (noEmbeddingDiv, null, Loc ('Embedding KreaCAD in an iframe is not supported.'));
            let link = AddDomElement (noEmbeddingDiv, 'a', null, Loc ('Open KreaCAD'));
            link.target = '_blank';
            link.href = window.self.location;
            return;
        }

        document.getElementById ('intro_dragdrop_text').innerHTML = Loc ('Drag and drop 3D models here.');
        document.getElementById ('intro_formats_title').innerHTML = Loc ('Open some samples:');

        let website = new Website ({
            headerDiv : document.getElementById ('header'),
            headerButtonsDiv : document.getElementById ('header_buttons'),
            toolbarDiv : document.getElementById ('toolbar'),
            mainDiv : document.getElementById ('main'),
            introDiv : document.getElementById ('intro'),
            introContentDiv : document.getElementById ('intro_content'),
            fileNameDiv : document.getElementById ('main_file_name'),
            leftContainerDiv : document.getElementById ('main_left_container'),
            navigatorDiv : document.getElementById ('main_navigator'),
            navigatorSplitterDiv : document.getElementById ('main_navigator_splitter'),
            rightContainerDiv : document.getElementById ('main_right_container'),
            sidebarDiv : document.getElementById ('main_sidebar'),
            sidebarSplitterDiv : document.getElementById ('main_sidebar_splitter'),
            viewerDiv : document.getElementById ('main_viewer'),
            fileInput : document.getElementById ('open_file')
        });
        website.Load ();

        // Quick Action Buttons Wiring
        const qaOpen = document.getElementById('qa_open');
        const qaNew = document.getElementById('qa_new');
        const qaSaveAs = document.getElementById('qa_saveas');
        const qaHint = document.getElementById('qa_hint');
        const fileInput = document.getElementById('open_file');

        if (qaOpen && fileInput) {
            qaOpen.addEventListener('click', () => {
                fileInput.click();
            });
        }
        if (qaNew) {
            qaNew.addEventListener('click', () => {
                // Start empty primitive scene in main viewer instead of navigating away
                if (website && website.StartEmptyScene) {
                    website.StartEmptyScene();
                }
            });
        }
        if (qaSaveAs) {
            // Listen for model load events to enable button
            window.addEventListener('ov_model_loaded', () => {
                qaSaveAs.disabled = false;
                qaSaveAs.style.cursor = 'pointer';
                qaSaveAs.style.background = '#1e2530';
                qaSaveAs.style.color = '#fff';
                if (qaHint) { qaHint.textContent = 'Model loaded. You can Export/Save.'; }
            });
            qaSaveAs.addEventListener('click', () => {
                if (qaSaveAs.disabled) { return; }
                // Reuse export dialog for Save As
                if (window.OV && website && website.model && website.viewer) {
                    window.OV.ShowExportDialog(website.model, website.viewer, {
                        isMeshVisible : (meshInstanceId) => true
                    });
                } else {
                    // fallback: try to trigger download of original files
                    if (website && website.modelLoaderUI) {
                        const importer = website.modelLoaderUI.GetImporter();
                        if (importer) {
                            window.OV.HandleEvent && window.OV.HandleEvent('model_downloaded', 'quick_save');
                            window.OV.DownloadModel && window.OV.DownloadModel(importer);
                        }
                    }
                }
            });
        }
    });
}

export function StartEmbed ()
{
    window.addEventListener ('load', () => {
        let embed = new Embed ({
            viewerDiv : document.getElementById ('embed_viewer'),
            websiteLinkDiv : document.getElementById ('website_link')
        });
        embed.Load ();
    });
}

export { PrimitivesManager };
