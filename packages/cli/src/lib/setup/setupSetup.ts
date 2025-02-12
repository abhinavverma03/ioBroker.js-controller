/**
 *      Setup
 *
 *      Copyright 2013-2022 bluefox <dogafox@gmail.com>
 *
 *      MIT License
 *
 */

import type {
    CleanDatabaseHandler,
    DbConnectAsync,
    IoPackage,
    ProcessExitCallback,
    ResetDbConnect,
    RestartController
} from '../_Types';
import type { Client as StatesRedisClient } from '@iobroker/db-states-redis';
import type { Client as ObjectsRedisClient } from '@iobroker/db-objects-redis';

import fs from 'fs-extra';
import path from 'path';
import { EXIT_CODES, tools } from '@iobroker/js-controller-common';
import { tools as dbTools } from '@iobroker/js-controller-common-db';
import { BackupRestore } from './setupBackup';
import crypto from 'crypto';
import deepClone from 'deep-clone';
import * as pluginInfos from './pluginInfos';
import rl from 'readline-sync';
import os from 'os';

const COLOR_RED = '\x1b[31m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_RESET = '\x1b[0m';
const COLOR_GREEN = '\x1b[32m';
const CONTROLLER_DIR = tools.getControllerDir();

export interface CLISetupOptions {
    dbConnectAsync: DbConnectAsync;
    cleanDatabase: CleanDatabaseHandler;
    processExit: ProcessExitCallback;
    params: Record<string, any>;
    restartController: RestartController;
    resetDbConnect: ResetDbConnect;
}

type ConfigObject = ioBroker.OtherObject & { type: 'config' };

export class Setup {
    private readonly options: CLISetupOptions;
    private readonly processExit: ProcessExitCallback;
    private states: StatesRedisClient | undefined;
    private objects: ObjectsRedisClient | undefined;
    private readonly dbConnectAsync: DbConnectAsync;
    private readonly params: Record<string, any>;
    private readonly cleanDatabase: CleanDatabaseHandler;
    private readonly restartController: RestartController;
    private readonly resetDbConnect: ResetDbConnect;

    constructor(options: CLISetupOptions) {
        this.options = options;
        this.processExit = options.processExit;
        this.dbConnectAsync = options.dbConnectAsync;
        this.params = options.params;
        this.cleanDatabase = options.cleanDatabase;
        this.resetDbConnect = options.resetDbConnect;
        this.restartController = options.restartController;

        this.dbSetup = this.dbSetup.bind(this);
    }

    async informAboutPlugins(systemConfig?: ConfigObject | null): Promise<void> {
        if (!this.states) {
            throw new Error('States not set up, call setupObjects first');
        }

        let ioPackage: IoPackage | undefined;
        let ioConfig: ioBroker.IoBrokerJson | undefined;

        const configFile = tools.getConfigFileName();
        try {
            ioPackage = JSON.parse(fs.readFileSync(path.join(CONTROLLER_DIR, 'io-package.json'), 'utf8'));
        } catch {
            console.error('Cannot read js-controller io-package.json. Ignore plugins defined there.');
        }
        try {
            ioConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        } catch {
            console.error('Can not read js-controller config file. Ignore plugins defined there.');
        }

        const plugins: Record<string, any> = {};
        if (ioPackage?.common?.plugins) {
            for (const [plugin, pluginData] of Object.entries(ioPackage.common.plugins)) {
                if (pluginData.enabled !== false) {
                    plugins[plugin] = pluginData;
                }
            }
        }

        if (ioConfig?.plugins) {
            for (const [plugin, pluginData] of Object.entries(ioConfig.plugins)) {
                if (!plugins[plugin] && pluginData.enabled !== false) {
                    plugins[plugin] = pluginData;
                }
            }
        }

        let systemLang = 'en';
        let systemDiag = 'extended';
        if (systemConfig && systemConfig.common) {
            systemDiag = systemConfig.common.diag || 'extended';
            systemLang = systemConfig.common.language || 'en';
        }

        for (const plugin of Object.keys(plugins)) {
            // @ts-expect-error it is our testing style
            const pluginInfo = pluginInfos.PLUGIN_INFOS[plugin];
            if (!pluginInfo) {
                // We do not have relevant information to display
                continue;
            }
            if (systemDiag === 'none' && pluginInfos.isReportingPlugin(plugin)) {
                // Reporting plugins respect "diag" and do not send information if diag is disabled
                continue;
            }

            let enabledState;
            try {
                enabledState = await this.states.getStateAsync(
                    `system.host.${tools.getHostName()}.plugins.${plugin}.enabled`
                );
            } catch {
                // ignore
            }
            if (enabledState && enabledState.val !== undefined) {
                // already configured, so do not output again
                continue;
            }

            const infoHeadLine = pluginInfo.headline[systemLang] || pluginInfo.headline.en;
            const infoText = pluginInfo.text[systemLang] || pluginInfo.text.en;

            console.error(COLOR_RED);
            console.error(infoHeadLine);
            console.error(COLOR_YELLOW);
            console.error(infoText);
            console.error();
            console.error(COLOR_RESET);
        }
    }

    /**
     * Called after io-package objects are created
     *
     * @param systemConfig
     * @param callback
     */
    async setupReady(systemConfig: ConfigObject | undefined | null, callback: () => void): Promise<void> {
        if (!callback) {
            console.log(`database setup done. You can add adapters and start ${tools.appName} now`);
            return this.processExit(EXIT_CODES.NO_ERROR);
        }

        if (!this.objects) {
            throw new Error('Objects not set up, call setupObjects first');
        }

        // clean up invalid user group assignments (non-existing user in a group)
        try {
            await this._cleanupInvalidGroupAssignments();
        } catch (e) {
            console.error(`Cannot clean up invalid user group assignments: ${e.message}`);
        }

        // special methods which are only there on objects server
        // TODO this check will lead to objects being never in the following code
        if (!('syncFileDirectory' in this.objects) || !('dirExists' in this.objects)) {
            await this.informAboutPlugins(systemConfig);
            return void callback();
        }

        // check meta.user
        try {
            const objExists = await this.objects.objectExists('meta.user');
            if (objExists) {
                // check if dir is missing
                // @ts-expect-error due to check above type gets never, we should add the methods to the interface in db
                const dirExists = this.objects.dirExists('meta.user');
                if (!dirExists) {
                    // create meta.user, so users see them as upload target
                    await this.objects.mkdirAsync('meta.user');
                    console.log('Successfully created "meta.user" directory');
                }
            }
        } catch (err) {
            console.warn(`Could not create directory "meta.user": ${err.message}`);
        }

        try {
            // @ts-expect-error due to check above type gets never, we should add the methods to the interface in db
            const { numberSuccess, notifications } = this.objects.syncFileDirectory();
            numberSuccess &&
                console.log(
                    `${numberSuccess} file(s) successfully synchronized with ioBroker storage.
Please DO NOT copy files manually into ioBroker storage directories!`
                );
            if (notifications.length) {
                console.log();
                console.log('The following notifications happened during sync: ');
                notifications.forEach((el: string) => console.log(`- ${el}`));
                console.log();
            }
            await this.informAboutPlugins(systemConfig);
            return void callback();
        } catch (err) {
            console.error(`Error on file directory sync: ${err.message}`);
            await this.informAboutPlugins(systemConfig);
            return void callback();
        }
    }

    async dbSetup(iopkg: IoPackage, ignoreExisting: boolean, callback: () => void): Promise<void> {
        if (!this.objects) {
            throw new Error('Objects not set up, call setupObjects first');
        }

        if (iopkg.objects && iopkg.objects.length > 0) {
            const obj = iopkg.objects.pop()!;

            let existingObj: ioBroker.Object | undefined | null;
            try {
                existingObj = await this.objects.getObjectAsync(obj._id);
            } catch {
                // ignore
            }
            if (!existingObj || existingObj._id.startsWith('_design/')) {
                obj.from = `system.host.${tools.getHostName()}.cli`;
                obj.ts = Date.now();
                await this.objects.setObjectAsync(obj._id, obj);
                console.log(`object ${obj._id} ${!existingObj ? 'created' : 'updated'}`);
                setTimeout(this.dbSetup, 25, iopkg, ignoreExisting, callback);
            } else {
                if (!ignoreExisting) {
                    console.log(`object ${obj._id} already exists`);
                }
                setTimeout(this.dbSetup, 25, iopkg, ignoreExisting, callback);
            }
        } else {
            await tools.createUuid(this.objects);
            let configObj: ConfigObject | null | undefined;
            // check if encrypt secret exists
            try {
                configObj = await this.objects.getObject('system.config');
            } catch {
                // assume non existing
            }

            let configFixed = false;
            if (configObj && configObj.type !== 'config') {
                configObj.type = 'config';
                configObj.from = `system.host.${tools.getHostName()}.cli`;
                configObj.ts = Date.now();
                configFixed = true;
            }

            if (configObj && (!configObj.native || !configObj.native.secret)) {
                const buf = crypto.randomBytes(24);
                configObj.native = configObj!.native || {};
                configObj.native.secret = buf.toString('hex');
                configObj.from = `system.host.${tools.getHostName()}.cli`;
                configObj.ts = Date.now();
                this.objects!.setObject('system.config', configObj!, () => this.setupReady(configObj!, callback));
            } else {
                if (configFixed) {
                    this.objects.setObject('system.config', configObj!, () => this.setupReady(configObj!, callback));
                } else {
                    this.setupReady(configObj, callback);
                }
            }
        }
    }

    /**
     * Creates objects and does object related cleanup
     *
     * @param callback
     * @param checkCertificateOnly
     */
    async setupObjects(callback: () => void, checkCertificateOnly?: boolean): Promise<void> {
        const { states: _states, objects: _objects } = await this.dbConnectAsync(false, this.params);
        this.objects = _objects;
        this.states = _states;
        const iopkg = fs.readJsonSync(path.join(CONTROLLER_DIR, 'io-package.json'));

        await this._maybeMigrateSets();

        if (checkCertificateOnly) {
            let certObj;
            if (iopkg && iopkg.objects) {
                for (const obj of iopkg.objects) {
                    if (obj && obj._id === 'system.certificates') {
                        certObj = obj;
                        break;
                    }
                }
            }

            if (certObj) {
                let obj;
                try {
                    obj = await this.objects.getObjectAsync('system.certificates');
                } catch {
                    // ignore
                }

                if (obj?.native?.certificates?.defaultPublic !== undefined) {
                    let cert = tools.getCertificateInfo(obj.native.certificates.defaultPublic);

                    if (cert) {
                        const dateCertStart = cert.validityNotBefore.getTime();
                        const dateCertEnd = cert.validityNotAfter.getTime();

                        // check, if certificate is invalid (too old, longer then 825 days or keylength too short)
                        if (
                            dateCertEnd <= Date.now() ||
                            cert.keyLength < 2048 ||
                            dateCertEnd - dateCertStart > tools.MAX_CERT_VALIDITY
                        ) {
                            // generate new certificates
                            if (cert.certificateFilename) {
                                console.log(
                                    `Existing file certificate (${cert.certificateFilename}) is invalid (too old, validity longer then 345 days or keylength too short). Please check it!`
                                );
                            } else {
                                console.log(
                                    'Existing earlier generated certificate is invalid (too old, validity longer then 365 days or keylength too short). Generating new Certificate!'
                                );
                                cert = null;
                            }
                        }
                    }
                    if (!cert) {
                        const newCert = tools.generateDefaultCertificates();

                        obj.native.certificates.defaultPrivate = newCert.defaultPrivate;
                        obj.native.certificates.defaultPublic = newCert.defaultPublic;

                        try {
                            await this.objects.setObjectAsync(obj._id, obj);
                            console.log(`object ${obj._id} updated`);
                        } catch {
                            //ignore
                        }
                        this.dbSetup(iopkg, true, callback);
                        return;
                    }
                }
                this.dbSetup(iopkg, true, callback);
            } else {
                this.dbSetup(iopkg, true, callback);
            }
        } else {
            this.dbSetup(iopkg, false, callback);
        }
    }

    /**
     * Asks the user if he wants to migrate objects if it makes sense and performs migration according to input
     *
     * @param newConfig - updated config
     * @param oldConfig - previous config
     */
    async migrateObjects(newConfig: Record<string, any>, oldConfig: Record<string, any>): Promise<EXIT_CODES> {
        // allow migration if one of the db types changed or host changed of redis
        const oldStatesHasServer = dbTools.statesDbHasServer(oldConfig.states.type);
        const oldObjectsHasServer = dbTools.statesDbHasServer(oldConfig.objects.type);
        const newStatesHasServer = dbTools.statesDbHasServer(newConfig.states.type);
        const newObjectsHasServer = dbTools.statesDbHasServer(newConfig.objects.type);

        const oldStatesLocalServer = dbTools.isLocalStatesDbServer(oldConfig.states.type, oldConfig.states.host);
        const oldObjectsLocalServer = dbTools.isLocalObjectsDbServer(oldConfig.objects.type, oldConfig.objects.host);
        const newStatesLocalServer = dbTools.isLocalStatesDbServer(newConfig.states.type, newConfig.states.host);
        const newObjectsLocalServer = dbTools.isLocalObjectsDbServer(newConfig.objects.type, newConfig.objects.host);

        if (
            oldConfig &&
            (oldConfig.states.type !== newConfig.states.type ||
                oldConfig.objects.type !== newConfig.objects.type ||
                (!oldStatesHasServer && oldConfig.states.host !== newConfig.states.host) ||
                (!oldObjectsHasServer && oldConfig.objects.host !== newConfig.objects.host))
        ) {
            let fromMaster: boolean | null = oldStatesLocalServer || oldObjectsLocalServer;
            let toMaster: boolean | null = newStatesLocalServer || newObjectsLocalServer;

            if (!oldStatesHasServer && !oldObjectsHasServer) {
                fromMaster = null; // Master can not be detected, check new
            }
            if (!newStatesHasServer && !newObjectsHasServer) {
                toMaster = null; // new
            }

            let allowMigration;
            if (fromMaster) {
                if (!toMaster) {
                    const answer = rl.question(
                        `Please choose if this is a Master/single host (enter "m") or a Slave host (enter "S") you are about to edit. For Slave hosts the data migration will be skipped. [S/m]: `,
                        {
                            limit: /^[SsMm]?$/,
                            defaultInput: 'S'
                        }
                    );
                    allowMigration = !(answer === 'S' || answer === 's');
                } else {
                    const answer = rl.question(
                        `This host appears to be a Master or a Single host system. Is this correct? [Y/n]: `,
                        {
                            limit: /^[YyNnJj]?$/,
                            defaultInput: 'Y'
                        }
                    );
                    allowMigration = answer === 'Y' || answer === 'y' || answer === 'J' || answer === 'j';
                }
            } else {
                if (toMaster) {
                    const answer = rl.question(
                        `It appears that you want to convert this slave host into a Master or Single host system. Is this correct? [Y/n]: `,
                        {
                            limit: /^[YyNnJj]?$/,
                            defaultInput: 'Y'
                        }
                    );
                    allowMigration = answer === 'Y' || answer === 'y' || answer === 'J' || answer === 'j';
                } else {
                    const answer = rl.question(
                        `This host appears to be an ioBroker SLAVE system. Migration will be skipped. Is this correct? [Y/n]: `,
                        {
                            limit: /^[YyNnJj]?$/,
                            defaultInput: 'Y'
                        }
                    );
                    allowMigration = !(answer === 'Y' || answer === 'y' || answer === 'J' || answer === 'j');
                }
            }

            if (oldObjectsHasServer && !newObjectsHasServer) {
                console.log(COLOR_YELLOW);
                console.log(`Important: Using ${newConfig.objects.type} for the Objects database is only supported`);
                console.log('with js-controller 2.0 or higher!');
                console.log('When your system consists of multiple hosts please make sure to have');
                console.log('js-controller 2.0 or higher installed on ALL hosts *before* continuing!');
                if (allowMigration) {
                    console.log('');
                    console.log('');
                    console.log('Important #2: If you already did the migration on an other host');
                    console.log('please *do not* migrate again! This can destroy your system!');
                    console.log('');
                    console.log('');
                    console.log('Important #3: The process will migrate all files that were officially');
                    console.log('uploaded into the ioBroker system. If you have manually copied files into');
                    console.log('iobroker-data/files/... into own directories then these files will NOT be');
                    console.log('migrated! Make sure all files are in adapter directories inside the files');
                    console.log('directory!');
                }
                console.log(COLOR_RESET);
            }

            // FileDB -> JSONL migration is handled in the DB classes. Skip migration if both DBs are changed from File -> JsonL
            if (
                (oldConfig.states.type === newConfig.states.type ||
                    (oldConfig.states.type === 'file' && newConfig.states.type === 'jsonl')) &&
                (oldConfig.objects.type === newConfig.objects.type ||
                    (oldConfig.objects.type === 'file' && newConfig.objects.type === 'jsonl'))
            ) {
                console.log('Explicit migration from file to jsonl is not necessary, skipping...');
                allowMigration = false;
            }

            let answer = 'N';
            if (allowMigration) {
                console.log();
                answer = rl.question(
                    `Do you want to migrate objects and states from "${oldConfig.objects.type}/${oldConfig.states.type}" to "${newConfig.objects.type}/${newConfig.states.type}" [y/N]: `,
                    {
                        limit: /^[YyNnJj]?$/,
                        defaultInput: 'N'
                    }
                );

                if (
                    newConfig.objects.type !== oldConfig.objects.type &&
                    (answer === 'Y' || answer === 'y' || answer === 'J' || answer === 'j')
                ) {
                    console.log(COLOR_YELLOW);
                    answer = rl.question(
                        `Migrating the objects database will overwrite all objects! Are you sure that this is not a slave host and you want to migrate the data? [y/N]: `,
                        {
                            limit: /^[YyNnJj]?$/,
                            defaultInput: 'N'
                        }
                    );
                    console.log(COLOR_RESET);
                }
            }

            if (answer === 'Y' || answer === 'y' || answer === 'J' || answer === 'j') {
                console.log(`Connecting to previous DB "${oldConfig.objects.type}"...`);

                const {
                    objects: objectsOld,
                    states: statesOld,
                    isOffline
                } = await this.dbConnectAsync(false, this.params);

                if (!isOffline) {
                    console.error(COLOR_RED);
                    console.error('Cannot migrate DB while js-controller is still running!');
                    console.error(`Please stop ioBroker and try again. No settings have been changed.${COLOR_RESET}`);
                    return EXIT_CODES.CONTROLLER_RUNNING;
                }

                // TODO: rm this if procesExit is gone from BackupRestore
                // eslint-disable-next-line no-async-promise-executor
                return new Promise(async resolve => {
                    const backupCreate = new BackupRestore({
                        states: statesOld,
                        objects: objectsOld,
                        cleanDatabase: this.cleanDatabase,
                        restartController: this.restartController,
                        processExit: resolve
                    });

                    console.log('Creating backup ...');
                    console.log(`${COLOR_GREEN}This can take some time ... please be patient!${COLOR_RESET}`);

                    // TODO: this can call processExit internally we want to get rid of this in the future
                    let filePath = (await backupCreate.createBackup('', true))!;
                    const origBackupPath = filePath;
                    filePath = filePath.replace('.tar.gz', '-migration.tar.gz');
                    try {
                        fs.renameSync(origBackupPath, filePath);
                    } catch {
                        filePath = origBackupPath;
                        console.log('[Not Critical Error] Could not rename Backup file');
                    }

                    console.log(`Backup created: ${filePath}`);
                    await this.resetDbConnect();

                    console.log(`updating conf/${tools.appName.toLowerCase()}.json`);
                    fs.writeFileSync(`${tools.getConfigFileName()}.bak`, JSON.stringify(oldConfig, null, 2));
                    fs.writeFileSync(tools.getConfigFileName(), JSON.stringify(newConfig, null, 2));

                    console.log('');
                    console.log(`Connecting to new DB "${newConfig.objects.type}" (can take up to 20s) ...`);

                    const { objects: objectsNew, states: statesNew } = await this.dbConnectAsync(true, {
                        ...this.params,
                        timeout: 20000
                    });

                    this.objects = objectsNew;
                    this.states = statesNew;

                    if (!statesNew || !objectsNew) {
                        console.error(COLOR_RED);
                        console.log(
                            `New Database could not be connected. Please check your settings. No settings have been changed.${COLOR_RESET}`
                        );

                        console.log(`restoring conf/${tools.appName.toLowerCase()}.json`);
                        fs.writeFileSync(tools.getConfigFileName(), JSON.stringify(oldConfig, null, 2));
                        fs.unlinkSync(`${tools.getConfigFileName()}.bak`);

                        return EXIT_CODES.MIGRATION_ERROR;
                    }

                    const backupRestore = new BackupRestore({
                        states: statesNew,
                        objects: objectsNew,
                        cleanDatabase: this.cleanDatabase,
                        restartController: this.restartController,
                        processExit: resolve,
                        dbMigration: true
                    });
                    console.log('Restore backup ...');
                    console.log(`${COLOR_GREEN}This can take some time ... please be patient!${COLOR_RESET}`);
                    backupRestore.restoreBackup(filePath, false, true, async exitCode => {
                        if (exitCode) {
                            console.log(`Error happened during restore. Exit-Code: ${exitCode}`);
                            console.log();
                            console.log(`restoring conf/${tools.appName.toLowerCase()}.json`);
                            fs.writeFileSync(tools.getConfigFileName(), JSON.stringify(oldConfig, null, 2));
                            fs.unlinkSync(tools.getConfigFileName() + '.bak');
                        } else {
                            await this._maybeMigrateSets();
                            console.log('Backup restored - Migration successful');
                            console.log(COLOR_YELLOW);
                            console.log('Important: If your system consists of multiple hosts please execute ');
                            console.log('"iobroker upload all" on the master AFTER all other hosts/slaves have ');
                            console.log('also been updated to this states/objects database configuration AND are');
                            console.log(`running!${COLOR_RESET}`);
                        }

                        resolve(exitCode ? EXIT_CODES.MIGRATION_ERROR : EXIT_CODES.NO_ERROR);
                    });
                });
            } else if (!newObjectsHasServer) {
                console.log('');
                console.log('No Database migration was done.');
                console.log(
                    `${COLOR_YELLOW}If this was done on your master host please execute "iobroker setup first" to newly initialize all objects.${COLOR_RESET}`
                );
                console.log('');
            }
        }
        console.log(`updating conf/${tools.appName.toLowerCase()}.json`);
        fs.writeFileSync(tools.getConfigFileName(), JSON.stringify(newConfig, null, 2));
        return EXIT_CODES.NO_ERROR;
    }

    async setupCustom(): Promise<EXIT_CODES> {
        let config;
        let originalConfig;
        // read actual configuration
        try {
            if (fs.existsSync(tools.getConfigFileName())) {
                config = fs.readJsonSync(tools.getConfigFileName());
                originalConfig = deepClone(config);
            } else {
                config = fs.readJsonSync(path.join(CONTROLLER_DIR, 'conf', `${tools.appName.toLowerCase()}-dist.json`));
            }
        } catch {
            config = fs.readJsonSync(path.join(CONTROLLER_DIR, 'conf', `${tools.appName.toLowerCase()}-dist.json`));
        }

        const currentObjectsType = originalConfig.objects.type || 'jsonl';
        const currentStatesType = originalConfig.states.type || 'jsonl';
        console.log('Current configuration:');
        console.log('- Objects database:');
        console.log(`  - Type: ${originalConfig.objects.type}`);
        console.log(`  - Host/Unix Socket: ${originalConfig.objects.host}`);
        console.log(`  - Port: ${originalConfig.objects.port}`);
        if (Array.isArray(originalConfig.objects.host)) {
            console.log(
                `  - Sentinel-Master-Name: ${
                    originalConfig.objects.sentinelName ? originalConfig.objects.sentinelName : 'mymaster'
                }`
            );
        }
        console.log('- States database:');
        console.log(`  - Type: ${originalConfig.states.type}`);
        console.log(`  - Host/Unix Socket: ${originalConfig.states.host}`);
        console.log(`  - Port: ${originalConfig.states.port}`);
        if (Array.isArray(originalConfig.states.host)) {
            console.log(
                `  - Sentinel-Master-Name: ${
                    originalConfig.states.sentinelName ? originalConfig.states.sentinelName : 'mymaster'
                }`
            );
        }
        if (
            dbTools.objectsDbHasServer(originalConfig.objects.type) ||
            dbTools.statesDbHasServer(originalConfig.states.type)
        ) {
            console.log(`- Data Directory: ${tools.getDefaultDataDir()}`);
        }
        if (originalConfig && originalConfig.system && originalConfig.system.hostname) {
            console.log(`- Host name: ${originalConfig.system.hostname}`);
        }
        console.log('');

        let otype = rl.question(
            `Type of objects DB [(j)sonl, (f)ile, (r)edis, ...], default [${currentObjectsType}]: `,
            {
                defaultInput: currentObjectsType
            }
        );
        otype = otype.toLowerCase();

        if (otype === 'r') {
            otype = 'redis';
        } else if (otype === 'f') {
            otype = 'file';
        } else if (otype === 'j') {
            otype = 'jsonl';
        }

        let getDefaultObjectsPort;
        try {
            const path = require.resolve(`@iobroker/db-objects-${otype}`, {
                paths: tools.getDefaultRequireResolvePaths(module)
            });
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            getDefaultObjectsPort = require(path).getDefaultPort;
        } catch {
            console.log(`${COLOR_RED}Unknown objects type: ${otype}${COLOR_RESET}`);
            if (otype !== 'file' && otype !== 'redis') {
                console.log(COLOR_YELLOW);
                console.log(`Please check that the objects db type you entered is really correct!`);
                console.log(`If yes please use "npm i @iobroker/db-objects-${otype}" to install it manually.`);
                console.log(`You also need to make sure you stay up to date with this package in the future!`);
                console.log(COLOR_RESET);
            }
            return EXIT_CODES.INVALID_ARGUMENTS;
        }

        if (otype === 'redis' && originalConfig.objects.type !== 'redis') {
            console.log(COLOR_YELLOW);
            console.log('When Objects and Files are stored in a Redis database please consider the following:');
            console.log('1. All data will be stored in RAM, make sure to have enough free RAM available!');
            console.log(
                '2. Make sure to check Redis persistence options to make sure a Redis problem will not cause data loss!'
            );
            console.log('3. The Redis persistence files can get big, make sure not to use an SD card to store them.');
            console.log(COLOR_RESET);
        }

        const defaultObjectsHost =
            otype === originalConfig.objects.type ? originalConfig.objects.host : tools.getLocalAddress();
        let oHost: string | string[] = rl.question(
            `Host / Unix Socket of objects DB(${otype}), default[${
                Array.isArray(defaultObjectsHost) ? defaultObjectsHost.join(',') : defaultObjectsHost
            }]: `,
            {
                defaultInput: Array.isArray(defaultObjectsHost) ? defaultObjectsHost.join(',') : defaultObjectsHost
            }
        );
        oHost = oHost.toLowerCase();

        const op = getDefaultObjectsPort(oHost);
        const oSentinel = otype === 'redis' && oHost.includes(',');

        if (oSentinel) {
            oHost = oHost.split(',').map(host => host.trim());
        }

        const defaultObjectsPort =
            otype === originalConfig.objects.type && oHost === originalConfig.objects.host
                ? originalConfig.objects.port
                : op;

        const userObjPort = rl.question(
            `Port of objects DB(${otype}), default[${
                Array.isArray(defaultObjectsPort) ? defaultObjectsPort.join(',') : defaultObjectsPort
            }]: `,
            {
                defaultInput: Array.isArray(defaultObjectsPort) ? defaultObjectsPort.join(',') : defaultObjectsPort,
                limit: /^[0-9, ]+$/
            }
        );
        let oPort: number | number[];
        if (userObjPort.includes(',')) {
            try {
                oPort = userObjPort.split(',').map(port => {
                    const parsedPort = parseInt(port.trim(), 10);
                    if (isNaN(parsedPort)) {
                        console.log(`${COLOR_RED}Invalid objects port: ${parsedPort}${COLOR_RESET}`);
                        throw new Error(`Invalid objects port: ${parsedPort}`);
                    } else {
                        return parsedPort;
                    }
                });
            } catch {
                return EXIT_CODES.INVALID_ARGUMENTS;
            }
        } else {
            oPort = parseInt(userObjPort, 10);
            if (isNaN(oPort)) {
                console.log(`${COLOR_RED}Invalid objects port: ${oPort}${COLOR_RESET}`);
                return EXIT_CODES.INVALID_ARGUMENTS;
            }
        }

        let oSentinelName = null;
        if (oSentinel) {
            const defaultSentinelName = originalConfig.objects.sentinelName
                ? originalConfig.objects.sentinelName
                : 'mymaster';
            oSentinelName = rl.question(`Objects Redis Sentinel Master Name [${defaultSentinelName}]: `, {
                defaultInput: defaultSentinelName
            });
        }

        let defaultStatesType = currentStatesType;
        try {
            require.resolve(`@iobroker/db-states-${otype}`, {
                paths: tools.getDefaultRequireResolvePaths(module)
            });
            defaultStatesType = otype; // if states db is also available with same type we use as default
        } catch {
            // ignore, unchanged
        }

        let stype = rl.question(
            `Type of states DB [(j)sonl, (f)file, (r)edis, ...], default [${defaultStatesType}]: `,
            {
                defaultInput: defaultStatesType
            }
        );
        stype = stype.toLowerCase();

        if (stype === 'r') {
            stype = 'redis';
        } else if (stype === 'f') {
            stype = 'file';
        } else if (stype === 'j') {
            stype = 'jsonl';
        }

        let getDefaultStatesPort;
        try {
            const path = require.resolve(`@iobroker/db-states-${stype}`, {
                paths: tools.getDefaultRequireResolvePaths(module)
            });
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            getDefaultStatesPort = require(path).getDefaultPort;
        } catch {
            console.log(`${COLOR_RED}Unknown states type: ${stype}${COLOR_RESET}`);
            if (stype !== 'file' && stype !== 'redis') {
                console.log(COLOR_YELLOW);
                console.log(`Please check that the states db type you entered is really correct!`);
                console.log(`If yes please use "npm i @iobroker/db-states-${stype}" to install it manually.`);
                console.log(`You also need to make sure you stay up to date with this package in the future!`);
                console.log(COLOR_RESET);
            }
            return EXIT_CODES.INVALID_ARGUMENTS;
        }

        if (stype === 'redis' && originalConfig.states.type !== 'redis' && otype !== 'redis') {
            console.log(COLOR_YELLOW);
            console.log('When States are stored in a Redis database please make sure to configure Redis');
            console.log('persistence to make sure a Redis problem will not cause data loss!');
            console.log(COLOR_RESET);
        }

        let defaultStatesHost =
            stype === originalConfig.states.type ? originalConfig.states.host : oHost || tools.getLocalAddress();
        if (stype === otype) {
            defaultStatesHost = oHost;
        }
        let sHost: string | string[] = rl.question(
            `Host / Unix Socket of states DB (${stype}), default[${
                Array.isArray(defaultStatesHost) ? defaultStatesHost.join(',') : defaultStatesHost
            }]: `,
            {
                defaultInput: Array.isArray(defaultStatesHost) ? defaultStatesHost.join(',') : defaultStatesHost
            }
        );
        sHost = sHost.toLowerCase();

        const sp = getDefaultStatesPort(sHost);
        const sSentinel = stype === 'redis' && sHost.includes(',');

        if (sSentinel) {
            sHost = sHost.split(',').map(host => host.trim());
        }

        let defaultStatesPort =
            stype === originalConfig.states.type && sHost === originalConfig.states.host
                ? originalConfig.states.port
                : sp;
        if (stype === otype && !dbTools.statesDbHasServer(stype) && sHost === oHost) {
            defaultStatesPort = oPort;
        }
        const userStatePort = rl.question(
            `Port of states DB (${stype}), default[${
                Array.isArray(defaultStatesPort) ? defaultStatesPort.join(',') : defaultStatesPort
            }]: `,
            {
                defaultInput: Array.isArray(defaultStatesPort) ? defaultStatesPort.join(',') : defaultStatesPort,
                limit: /^[0-9, ]+$/
            }
        );
        let sPort: number | number[];
        if (userStatePort.includes(',')) {
            sPort = [];
            sPort = userStatePort.split(',').map(port => {
                try {
                    const parsedPort = parseInt(port.trim(), 10);
                    if (isNaN(parsedPort)) {
                        console.log(`${COLOR_RED}Invalid states port: ${parsedPort}${COLOR_RESET}`);
                        throw new Error(`Invalid states port: ${parsedPort}`);
                    } else {
                        return parsedPort;
                    }
                } catch {
                    return EXIT_CODES.INVALID_ARGUMENTS;
                }
            });
        } else {
            sPort = parseInt(userStatePort, 10);
            if (isNaN(sPort)) {
                console.log(`${COLOR_RED}Invalid states port: ${sPort}${COLOR_RESET}`);
                return EXIT_CODES.INVALID_ARGUMENTS;
            }
        }

        let sSentinelName = null;
        if (sSentinel) {
            const defaultSentinelName = originalConfig.states.sentinelName
                ? originalConfig.states.sentinelName
                : oSentinelName && oPort === sPort
                ? oSentinelName
                : 'mymaster';
            sSentinelName = rl.question(`States Redis Sentinel Master Name [${defaultSentinelName}]: `, {
                defaultInput: defaultSentinelName
            });
        }

        let dir;
        let hname;

        if (dbTools.isLocalStatesDbServer(stype, sHost) || dbTools.isLocalObjectsDbServer(otype, oHost)) {
            let validDataDir = false;

            while (!validDataDir) {
                dir = rl.question(`Data directory (file), default[${tools.getDefaultDataDir()}]: `, {
                    defaultInput: tools.getDefaultDataDir()
                });

                const validationInfo = tools.validateDataDir(dir);

                validDataDir = validationInfo.valid;

                if (!validDataDir) {
                    console.warn(
                        `${COLOR_YELLOW}The data directory is invalid. ${validationInfo.reason}${COLOR_RESET}`
                    );
                    console.warn(`The current directory resolves to "${validationInfo.path}"`);
                }
            }

            hname = rl.question(
                `Host name of this machine [${
                    originalConfig && originalConfig.system
                        ? originalConfig.system.hostname || os.hostname()
                        : os.hostname()
                }]: `,
                {
                    defaultInput: (originalConfig && originalConfig.system && originalConfig.system.hostname) || ''
                }
            );
        } else {
            hname = rl.question(`Host name of this machine [${os.hostname()}]: `, {
                defaultInput: ''
            });
        }

        if (hname.match(/\s/)) {
            console.log(`${COLOR_RED}Invalid host name: ${hname}${COLOR_RESET}`);
            return EXIT_CODES.INVALID_ARGUMENTS;
        }

        config.system = config.system || {};
        config.system.hostname = hname;
        config.objects.host = oHost;
        config.objects.type = otype;
        config.objects.port = oPort;
        config.states.host = sHost;
        config.states.type = stype;
        config.states.port = sPort;
        config.states.dataDir = undefined;
        config.objects.dataDir = undefined;
        if (dir) {
            config.objects.dataDir = dir;
        }
        if (dir) {
            config.states.dataDir = dir;
        }
        if (config.objects.type === 'redis' && oSentinel && oSentinelName && oSentinelName !== 'mymaster') {
            config.objects.sentinelName = oSentinelName;
        }
        if (config.states.type === 'redis' && sSentinel && sSentinelName && sSentinelName !== 'mymaster') {
            config.states.sentinelName = sSentinelName;
        }

        const exitCode = await this.migrateObjects(config, originalConfig);
        return exitCode;
    }

    /**
     * Checks if single host setup and if so migrates and activates Redis Sets Usage
     */
    private async _maybeMigrateSets(): Promise<void> {
        if (!this.objects) {
            throw new Error('Objects not set up, call setupObjects first');
        }

        try {
            // if we have a single host system we need to ensure that existing objects are migrated to sets before doing anything else
            if (await tools.isSingleHost(this.objects)) {
                await this.objects.activateSets();
                const noMigrated = await this.objects.migrateToSets();

                if (noMigrated) {
                    console.log(`Successfully migrated ${noMigrated} objects to Redis Sets`);
                }
            }
        } catch (e) {
            console.warn(`Could not migrate objects to corresponding sets: ${e.message}`);
        }
    }

    /**
     * Removes non-existing users from groups
     */
    private async _cleanupInvalidGroupAssignments(): Promise<void> {
        if (!this.objects) {
            throw new Error('Objects not set up, call setupObjects first');
        }

        const usersView = await this.objects.getObjectViewAsync('system', 'user');
        const groupView = await this.objects.getObjectViewAsync('system', 'group');

        const existingUsers = usersView!.rows.map(
            (obj: ioBroker.GetObjectViewItem<ioBroker.UserObject>) => obj.value!._id
        );

        for (const group of groupView!.rows) {
            // reference for readability
            const groupMembers = group.value.common.members;

            if (!Array.isArray(groupMembers)) {
                // fix legacy objects
                const obj = group.value;
                obj.common.members = [];
                await this.objects.setObjectAsync(obj._id, obj);
                continue;
            }

            let changed = false;

            for (let i = groupMembers.length - 1; i >= 0; i--) {
                if (!existingUsers.includes(groupMembers[i])) {
                    // we have found a non-existing user, so remove it
                    changed = true;
                    console.log(`Removed non-existing user "${groupMembers[i]}" from group "${group.value._id}"`);
                    groupMembers.splice(i, 1);
                }
            }

            if (changed) {
                await this.objects.setObjectAsync(group.value._id, group.value);
            }
        }
    }

    setup(callback: (isCreated?: boolean) => void, ignoreIfExist: boolean, useRedis: boolean): void {
        let config;
        let isCreated = false;
        const platform = os.platform();
        const otherInstallDirs = [];

        // copy reinstall.js file into root
        if (fs.existsSync(path.join(CONTROLLER_DIR, '..', '..', 'node_modules'))) {
            try {
                if (fs.existsSync(path.join(CONTROLLER_DIR, 'reinstall.js'))) {
                    fs.writeFileSync(
                        path.join(CONTROLLER_DIR, '..', '..', 'reinstall.js'),
                        fs.readFileSync(path.join(CONTROLLER_DIR, 'reinstall.js'))
                    );
                }
            } catch (e) {
                console.warn(`Cannot write file. Not critical: ${e.message}`);
            }
        }
        // Delete files for other OS
        if (platform.startsWith('win')) {
            otherInstallDirs.push(path.join(CONTROLLER_DIR, tools.appName));
            otherInstallDirs.push(path.join(CONTROLLER_DIR, tools.appName.substring(0, 3)));
            otherInstallDirs.push(path.join(CONTROLLER_DIR, 'killall.sh'));
            otherInstallDirs.push(path.join(CONTROLLER_DIR, 'reinstall.sh'));
        } else {
            // copy scripts to root directory
            if (fs.existsSync(path.join(CONTROLLER_DIR, '..', '..', 'node_modules'))) {
                const startFile = `#!/usr/bin/env node
require('${path.normalize(__dirname + '/..')}/setup').execute();`;

                try {
                    if (fs.existsSync(path.join(CONTROLLER_DIR, 'killall.sh'))) {
                        fs.writeFileSync(
                            path.join(CONTROLLER_DIR, '..', '..', 'killall.sh'),
                            fs.readFileSync(path.join(CONTROLLER_DIR, 'killall.sh')),
                            { mode: 492 /* 0754 */ }
                        );
                    }
                    if (fs.existsSync(path.join(CONTROLLER_DIR, 'reinstall.sh'))) {
                        fs.writeFileSync(
                            path.join(CONTROLLER_DIR, '..', '..', 'reinstall.sh'),
                            fs.readFileSync(path.join(CONTROLLER_DIR, 'reinstall.sh')),
                            { mode: 492 /* 0754 */ }
                        );
                    }
                    if (!fs.existsSync(path.join(CONTROLLER_DIR, '..', '..', `${tools.appName.substring(0, 3)}`))) {
                        fs.writeFileSync(
                            path.join(CONTROLLER_DIR, '..', '..', `${tools.appName.substring(0, 3)}`),
                            startFile,
                            {
                                mode: 492 /* 0754 */
                            }
                        );
                    }
                    if (!fs.existsSync(path.join(CONTROLLER_DIR, '..', '..', `${tools.appName}`))) {
                        fs.writeFileSync(path.join(CONTROLLER_DIR, '..', '..', `${tools.appName}`), startFile, {
                            mode: 492 /* 0754 */
                        });
                    }
                } catch (e) {
                    console.warn(`Cannot write file. Not critical: ${e.message}`);
                }
            }
        }

        for (let t = 0; t < otherInstallDirs.length; t++) {
            if (fs.existsSync(otherInstallDirs[t])) {
                const stat = fs.statSync(otherInstallDirs[t]);
                if (stat.isDirectory()) {
                    const files = fs.readdirSync(otherInstallDirs[t]);
                    for (let f = 0; f < files.length; f++) {
                        fs.unlinkSync(path.join(otherInstallDirs[t], files[f]));
                    }
                    fs.rmdirSync(otherInstallDirs[t]);
                } else {
                    try {
                        fs.unlinkSync(otherInstallDirs[t]);
                    } catch (e) {
                        console.warn(`Cannot delete file. Not critical: ${e.message}`);
                    }
                }
            }
        }

        // Create log and tmp directory
        if (!fs.existsSync(`${CONTROLLER_DIR}/tmp`)) {
            fs.mkdirSync(`${CONTROLLER_DIR}/tmp`);
        }

        const configFileName = tools.getConfigFileName();

        // only change config if non existing - else setup custom has to be used
        if (!fs.existsSync(configFileName)) {
            isCreated = true;
            config = fs.readJsonSync(path.join(CONTROLLER_DIR, 'conf', `${tools.appName.toLowerCase()}-dist.json`));

            console.log(`creating conf/${tools.appName.toLowerCase()}.json`);
            config.objects.host = this.params.objects || tools.getLocalAddress();
            config.states.host = this.params.states || tools.getLocalAddress();
            if (useRedis) {
                config.states.type = 'redis';
                config.states.port = this.params.port || 6379;
                config.objects.type = 'redis';
                config.objects.port = this.params.port || 6379;
            }

            // this path is relative to js-controller
            config.dataDir = tools.getDefaultDataDir();

            fs.mkdirSync(path.join(CONTROLLER_DIR, config.dataDir), { recursive: true });

            const dirName = path.dirname(configFileName);

            if (!fs.existsSync(dirName)) {
                fs.mkdirSync(dirName.replace(/\\/g, '/'), { recursive: true });
            }

            // Create default data dir
            fs.writeFileSync(configFileName, JSON.stringify(config, null, 2));

            try {
                // Create
                if (
                    __dirname
                        .toLowerCase()
                        .replace(/\\/g, '/')
                        .includes(`node_modules/${tools.appName.toLowerCase()}.js-controller`)
                ) {
                    const parts = config.dataDir.split('/');
                    // Remove appName-data/
                    parts.pop();
                    parts.pop();
                    const path_ = parts.join('/');

                    if (!fs.existsSync(path.join(CONTROLLER_DIR, path_, 'log'))) {
                        fs.mkdirSync(path.join(CONTROLLER_DIR, path_, 'log'));
                    }
                } else {
                    if (!fs.existsSync(path.join(CONTROLLER_DIR, 'log'))) {
                        fs.mkdirSync(path.join(CONTROLLER_DIR, 'log'));
                    }
                }
            } catch (err) {
                console.log(`Non-critical error: ${err.message}`);
            }
        } else if (ignoreIfExist) {
            // it is a setup first run and config exists yet
            try {
                config = fs.readJSONSync(configFileName);
                if (!Object.prototype.hasOwnProperty.call(config, 'dataDir')) {
                    // Workaround: there was a bug with admin v5 which could remove the dataDir attribute -> fix this
                    // TODO: remove it as soon as all adapters are fixed which use systemConfig.dataDir, with v5.1 we can for sure remove this
                    config.dataDir = tools.getDefaultDataDir();
                    fs.writeJSONSync(configFileName, config, { spaces: 2 });
                }
            } catch (err) {
                console.warn(`Cannot check config file: ${err.message}`);
            }

            this.setupObjects(() => callback && callback(), true);
            return;
        }

        this.setupObjects(() => callback && callback(isCreated));
    }
}
