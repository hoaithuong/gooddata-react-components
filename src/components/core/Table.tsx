import * as React from 'react';
import bindAll = require('lodash/bindAll');
import get = require('lodash/get');
import noop = require('lodash/noop');
import isEqual = require('lodash/isEqual');
import { ResponsiveTable, Table as IndigoTable, TableTransformation } from '@gooddata/indigo-visualizations';
import {
    DataSource,
    DataSourceUtils,
    ExecutorResult,
    MetadataSource,
    Transformation,
    VisualizationObject
} from '@gooddata/data-layer';

import { IntlWrapper } from './base/IntlWrapper';
import { IEvents, ILoadingState } from '../../interfaces/Events';
import { IDrillableItem } from '../../interfaces/DrillableItem';
import { IVisualizationProperties } from '../../interfaces/VisualizationProperties';
import { tablePropTypes } from '../../proptypes/Table';
import { ISorting } from '../../helpers/metadata';
import { getSorting, ISortingChange } from '../../helpers/sorting';
import { getCancellable } from '../../helpers/promise';

import { ErrorStates } from '../../constants/errorStates';
import { initTableDataLoading as initDataLoading } from '../../helpers/load';
import { IntlTranslationsProvider } from './base/TranslationsProvider';
import { IExecutorResult } from './base/BaseChart';
import { getVisualizationOptions } from '../../helpers/options';

export interface ITableProps extends IEvents {
    dataSource: DataSource.IDataSource;
    metadataSource?: MetadataSource.IMetadataSource;
    transformation?: Transformation.ITransformation;
    locale?: string;
    height?: number;
    environment?: string;
    stickyHeader?: number;
    drillableItems?: IDrillableItem[];
    afterRender?;
    pushData?;
    visualizationProperties?: IVisualizationProperties;
}

export interface ITableState {
    error: string;
    result: ExecutorResult.ISimpleExecutorResult;
    metadata: VisualizationObject.IVisualizationObjectMetadata;
    isLoading: boolean;
    sorting: ISorting;
    page: number;
}

const defaultErrorHandler = (error) => {
    if (error.status !== ErrorStates.OK) {
        console.error(error);
    }
};

export class Table extends React.Component<ITableProps, ITableState> {
    public static defaultProps: Partial<ITableProps> = {
        metadataSource: null,
        transformation: {},
        onError: defaultErrorHandler,
        onLoadingChanged: noop,
        afterRender: noop,
        pushData: noop,
        stickyHeader: 0,
        height: 300,
        locale: 'en-US',
        environment: 'none',
        drillableItems: [],
        visualizationProperties: null
    };

    static propTypes = tablePropTypes;

    private dataCancellable;

    constructor(props) {
        super(props);

        this.state = {
            error: ErrorStates.OK,
            result: null,
            isLoading: false,
            sorting: null,
            metadata: null,
            page: 1
        };

        bindAll(this, ['onSortChange', 'onLoadingChanged', 'onDataTooLarge', 'onError', 'onMore', 'onLess']);

        this.dataCancellable = null;
    }

    public componentDidMount() {
        const { metadataSource, dataSource, transformation } = this.props;
        this.initDataLoading(dataSource, metadataSource, transformation);
    }

    public componentWillReceiveProps(nextProps) {
        const sortingPrev = get(this.props.visualizationProperties, 'sorting');
        const sortingNext = get(nextProps.visualizationProperties, 'sorting');
        // next sorting needs to be different from previous and also
        // than actual inner sorting to get rid of duplicate execution
        // This handles only UNDO sorting change
        const sortingChanged = !isEqual(sortingPrev, sortingNext) && !isEqual(this.state.sorting, sortingNext);

        if (!DataSourceUtils.dataSourcesMatch(this.props.dataSource, nextProps.dataSource) || sortingChanged) {
            if (this.dataCancellable) {
                this.dataCancellable.cancel();
            }

            const sorting = sortingChanged ? sortingNext : this.state.sorting;

            const { metadataSource, dataSource, transformation } = nextProps;
            this.initDataLoading(dataSource, metadataSource, transformation, sorting);
        }
    }

    public componentWillUnmount() {
        if (this.dataCancellable) {
            this.dataCancellable.cancel();
        }
        this.onLoadingChanged = noop;
        this.onError = noop;
    }

    public onSortChange(change: ISortingChange) {
        const sorting = getSorting(change, get(this.state.sorting, 'sorting'));
        const sortingInfo = {
            sorting, change
        };
        this.setState({
            sorting: sortingInfo
        });

        const { metadataSource, dataSource, transformation } = this.props;
        this.props.pushData({
            properties: {
                sorting: sortingInfo
            }
        });
        this.initDataLoading(dataSource, metadataSource, transformation, sortingInfo);
    }

    public onMore({ page }) {
        this.setState({
            page
        });
    }

    public onLess() {
        this.setState({
            page: 1
        });
    }

    public render() {
        const { result, metadata, page } = this.state;
        const metadataContent = get(metadata, 'content', { buckets: {} });
        const { afterRender, height, locale, stickyHeader, drillableItems } = this.props;

        if (this.canRender()) {
            if (this.props.environment === 'dashboards') {
                const TABLE_PAGE_SIZE = 9;
                const tableRenderer = props =>
                    (<ResponsiveTable
                        {...props}
                        afm={this.props.dataSource.getAfm()}
                        rowsPerPage={TABLE_PAGE_SIZE}
                        onSortChange={this.onSortChange}
                        page={page}
                        onMore={this.onMore}
                        onLess={this.onLess}
                    />);
                return (
                    <IntlWrapper locale={locale}>
                        <IntlTranslationsProvider result={result}>
                            <TableTransformation
                                data={{}} // will be replaced by IntlTranslationsProvider
                                drillableItems={drillableItems}
                                tableRenderer={tableRenderer}
                                afterRender={afterRender}
                                height={height}
                                onDataTooLarge={this.onDataTooLarge}
                                config={{
                                    stickyHeader,
                                    ...metadataContent
                                }}
                            />
                        </IntlTranslationsProvider>
                    </IntlWrapper>
                );
            }

            const tableRenderer = tableProps =>
                <IndigoTable {...tableProps} afm={this.props.dataSource.getAfm()} onSortChange={this.onSortChange} />;
            return (
                <IntlWrapper locale={locale}>
                    <IntlTranslationsProvider result={result}>
                        <TableTransformation
                            data={{}} // will be replaced by IntlTranslationsProvider
                            drillableItems={drillableItems}
                            afterRender={afterRender}
                            tableRenderer={tableRenderer}
                            height={height}
                            config={{
                                stickyHeader,
                                ...metadataContent
                            }}
                        />
                    </IntlTranslationsProvider>
                </IntlWrapper>
            );
        }

        return null;
    }

    private canRender() {
        const { result, isLoading, error } = this.state;
        return result && !isLoading && error === ErrorStates.OK;
    }

    private onError(errorCode, dataSource = this.props.dataSource, options = {}) {
        if (DataSourceUtils.dataSourcesMatch(this.props.dataSource, dataSource)) {
            this.setState({
                error: errorCode
            });
            this.onLoadingChanged({ isLoading: false });
            this.props.onError({ status: errorCode, options });
        }
    }

    private onDataTooLarge() {
        this.onError(ErrorStates.DATA_TOO_LARGE_TO_DISPLAY);
    }

    private onLoadingChanged(loadingState: ILoadingState) {
        this.props.onLoadingChanged(loadingState);
        const isLoading = loadingState.isLoading;

        if (isLoading) {
            this.props.onError({ status: ErrorStates.OK }); // reset all errors in parent on loading start
            this.setState({
                isLoading,
                error: ErrorStates.OK // reset local errors
            });
        } else {
            this.setState({
                isLoading
            });
        }
    }

    private initDataLoading(
                dataSource: DataSource.IDataSource,
                metadataSource: MetadataSource.IMetadataSource,
                transformation: Transformation.ITransformation,
                sorting = null
    ) {
        this.onLoadingChanged({ isLoading: true });

        if (this.dataCancellable) {
            this.dataCancellable.cancel();
        }

        const visualizationOptions = getVisualizationOptions(dataSource.getAfm());

        this.dataCancellable = getCancellable(initDataLoading(dataSource, metadataSource, transformation, sorting));
        this.dataCancellable.promise.then((result) => {
            if (DataSourceUtils.dataSourcesMatch(this.props.dataSource, dataSource)) {
                const executionResult = get<IExecutorResult, ExecutorResult.ISimpleExecutorResult>(result, 'result');
                const metadata = get<IExecutorResult,
                    VisualizationObject.IVisualizationObjectMetadata>(result, 'metadata');
                const sorting = get<IExecutorResult, ISorting>(result, 'sorting');

                this.setState({
                    result: executionResult,
                    metadata,
                    sorting
                });
                this.props.pushData({
                    executionResult,
                    options: visualizationOptions
                });
                this.onLoadingChanged({ isLoading: false });
            }
        }, (error) => {
            if (error !== ErrorStates.PROMISE_CANCELLED) {
                this.onError(error, dataSource, visualizationOptions);
            }
        });
    }
}
