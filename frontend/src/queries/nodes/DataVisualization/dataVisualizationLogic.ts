import { actions, afterMount, connect, kea, key, listeners, path, props, reducers, selectors } from 'kea'
import { subscriptions } from 'kea-subscriptions'
import mergeObject from 'lodash.merge'
import { insightSceneLogic } from 'scenes/insights/insightSceneLogic'
import { teamLogic } from 'scenes/teamLogic'

import { insightVizDataCollectionId } from '~/queries/nodes/InsightViz/InsightViz'
import { AnyResponseType, ChartAxis, ChartSettingsFormatting, DataVisualizationNode } from '~/queries/schema'
import { QueryContext } from '~/queries/types'
import { ChartDisplayType, InsightLogicProps, ItemMode } from '~/types'

import { dataNodeLogic } from '../DataNode/dataNodeLogic'
import { getQueryFeatures, QueryFeature } from '../DataTable/queryFeatures'
import type { dataVisualizationLogicType } from './dataVisualizationLogicType'

export enum SideBarTab {
    Series = 'series',
    Display = 'display',
}

export interface Column {
    name: string
    type: string
    label: string
    dataIndex: number
}

export interface AxisSeriesSettings {
    formatting?: ChartSettingsFormatting
}

export interface AxisSeries<T> {
    column: Column
    data: T[]
    settings?: AxisSeriesSettings
}

export interface DataVisualizationLogicProps {
    key: string
    query: DataVisualizationNode
    insightLogicProps: InsightLogicProps
    context?: QueryContext
    setQuery?: (node: DataVisualizationNode) => void
    cachedResults?: AnyResponseType
}

export interface SelectedYAxis {
    name: string
    settings: AxisSeriesSettings
}

export const EmptyYAxisSeries: AxisSeries<number> = {
    column: {
        name: 'None',
        type: 'None',
        label: 'None',
        dataIndex: -1,
    },
    data: [],
}

const DefaultAxisSettings: AxisSeriesSettings = {
    formatting: {
        prefix: '',
        suffix: '',
    },
}

export const formatDataWithSettings = (data: number, settings?: AxisSeriesSettings): string => {
    const decimalPlaces = settings?.formatting?.decimalPlaces

    let dataAsString = `${decimalPlaces ? data.toFixed(decimalPlaces) : data}`

    if (settings?.formatting?.style === 'number') {
        dataAsString = data.toLocaleString(undefined, { maximumFractionDigits: decimalPlaces })
    }

    if (settings?.formatting?.style === 'percent') {
        dataAsString = `${data.toLocaleString(undefined, { maximumFractionDigits: decimalPlaces })}%`
    }

    if (settings?.formatting?.prefix) {
        dataAsString = `${settings.formatting.prefix}${dataAsString}`
    }

    if (settings?.formatting?.suffix) {
        dataAsString = `${dataAsString}${settings.formatting.suffix}`
    }

    return dataAsString
}

export const dataVisualizationLogic = kea<dataVisualizationLogicType>([
    key((props) => props.key),
    path(['queries', 'nodes', 'DataVisualization', 'dataVisualizationLogic']),
    connect((props: DataVisualizationLogicProps) => ({
        values: [
            teamLogic,
            ['currentTeamId'],
            insightSceneLogic,
            ['insightMode'],
            dataNodeLogic({
                cachedResults: props.cachedResults,
                key: props.key,
                query: props.query.source,
                dataNodeCollectionId: insightVizDataCollectionId(props.insightLogicProps, props.key),
                loadPriority: props.insightLogicProps.loadPriority,
            }),
            ['response', 'responseLoading'],
        ],
    })),
    props({ query: {} } as DataVisualizationLogicProps),
    actions({
        setVisualizationType: (visualizationType: ChartDisplayType) => ({ visualizationType }),
        updateXSeries: (columnName: string) => ({
            columnName,
        }),
        updateYSeries: (seriesIndex: number, columnName: string, settings?: AxisSeriesSettings) => ({
            seriesIndex,
            columnName,
            settings,
        }),
        addYSeries: (columnName?: string, settings?: AxisSeriesSettings) => ({ columnName, settings }),
        deleteYSeries: (seriesIndex: number) => ({ seriesIndex }),
        clearAxis: true,
        setQuery: (node: DataVisualizationNode) => ({ node }),
        setSideBarTab: (tab: SideBarTab) => ({ tab }),
    }),
    reducers({
        visualizationType: [
            ChartDisplayType.ActionsTable as ChartDisplayType,
            {
                setVisualizationType: (_, { visualizationType }) => visualizationType,
            },
        ],
        selectedXAxis: [
            null as string | null,
            {
                clearAxis: () => null,
                updateXSeries: (_, { columnName }) => columnName,
            },
        ],
        selectedYAxis: [
            null as (SelectedYAxis | null)[] | null,
            {
                clearAxis: () => null,
                addYSeries: (state, { columnName, settings }) => {
                    if (!state && columnName !== undefined) {
                        return [{ name: columnName, settings: settings ?? DefaultAxisSettings }]
                    }

                    if (!state) {
                        return [null]
                    }

                    return [
                        ...state,
                        columnName === undefined
                            ? null
                            : { name: columnName, settings: settings ?? DefaultAxisSettings },
                    ]
                },
                updateYSeries: (state, { seriesIndex, columnName, settings }) => {
                    if (!state) {
                        return null
                    }

                    const ySeries = [...state]

                    ySeries[seriesIndex] = {
                        name: columnName,
                        settings: mergeObject(ySeries[seriesIndex]?.settings ?? {}, settings),
                    }
                    return ySeries
                },
                deleteYSeries: (state, { seriesIndex }) => {
                    if (!state) {
                        return null
                    }

                    if (state.length <= 1) {
                        return [null]
                    }

                    const ySeries = [...state]

                    ySeries.splice(seriesIndex, 1)

                    return ySeries
                },
            },
        ],
        activeSideBarTab: [
            SideBarTab.Series as SideBarTab,
            {
                setSideBarTab: (_state, { tab }) => tab,
            },
        ],
    }),
    selectors({
        columns: [
            (s) => [s.response],
            (response): Column[] => {
                if (!response) {
                    return []
                }

                const columns: string[] = response['columns'] ?? []
                const types: string[][] = response['types'] ?? []

                return columns.map((column, index) => {
                    const type = types[index]?.[1]
                    return {
                        name: column,
                        type,
                        label: `${column} - ${type}`,
                        dataIndex: index,
                    }
                })
            },
        ],
        query: [(_state, props) => [props.query], (query) => query],
        showEditingUI: [
            (state, props) => [state.insightMode, props.insightLogicProps],
            (insightMode, insightLogicProps) => {
                if (insightLogicProps.dashboardId) {
                    return false
                }

                return insightMode == ItemMode.Edit
            },
        ],
        showResultControls: [
            (state, props) => [state.insightMode, props.insightLogicProps],
            (insightMode, insightLogicProps) => {
                if (insightMode === ItemMode.Edit) {
                    return true
                }

                return !insightLogicProps.dashboardId
            },
        ],
        presetChartHeight: [
            (_state, props) => [props.insightLogicProps],
            (insightLogicProps) => {
                return !insightLogicProps.dashboardId
            },
        ],
        sourceFeatures: [(_, props) => [props.query], (query): Set<QueryFeature> => getQueryFeatures(query.source)],
        isShowingCachedResults: [
            () => [(_, props) => props.cachedResults ?? null],
            (cachedResults: AnyResponseType | null): boolean => !!cachedResults,
        ],
        yData: [
            (state) => [state.selectedYAxis, state.response, state.columns],
            (ySeries, response, columns): AxisSeries<number>[] => {
                if (!response || ySeries === null || ySeries.length === 0) {
                    return [EmptyYAxisSeries]
                }

                const data: any[] = response?.['results'] ?? response?.['result'] ?? []

                return ySeries
                    .map((series): AxisSeries<number> | null => {
                        if (!series) {
                            return EmptyYAxisSeries
                        }

                        const column = columns.find((n) => n.name === series.name)
                        if (!column) {
                            return EmptyYAxisSeries
                        }

                        return {
                            column,
                            data: data.map((n) => {
                                try {
                                    const multiplier = series.settings.formatting?.style === 'percent' ? 100 : 1

                                    if (series.settings.formatting?.decimalPlaces) {
                                        return parseFloat(
                                            (parseFloat(n[column.dataIndex]) * multiplier).toFixed(
                                                series.settings.formatting.decimalPlaces
                                            )
                                        )
                                    }

                                    const isInt = Number.isInteger(n[column.dataIndex])
                                    return isInt
                                        ? parseInt(n[column.dataIndex], 10) * multiplier
                                        : parseFloat(n[column.dataIndex]) * multiplier
                                } catch {
                                    return 0
                                }
                            }),
                            settings: series.settings,
                        }
                    })
                    .filter((series): series is AxisSeries<number> => Boolean(series))
            },
        ],
        xData: [
            (state) => [state.selectedXAxis, state.response, state.columns],
            (xSeries, response, columns): AxisSeries<string> | null => {
                if (!response || xSeries === null) {
                    return {
                        column: {
                            name: 'None',
                            type: 'None',
                            label: 'None',
                            dataIndex: -1,
                        },
                        data: [],
                    }
                }

                const data: any[] = response?.['results'] ?? response?.['result'] ?? []

                const column = columns.find((n) => n.name === xSeries)
                if (!column) {
                    return null
                }

                return {
                    column,
                    data: data.map((n) => n[column.dataIndex]),
                }
            },
        ],
        dataVisualizationProps: [() => [(_, props) => props], (props): DataVisualizationLogicProps => props],
    }),
    listeners(({ props }) => ({
        setQuery: ({ node }) => {
            if (props.setQuery) {
                props.setQuery(node)
            }
        },
        setVisualizationType: ({ visualizationType }) => {
            if (props.setQuery) {
                props.setQuery({
                    ...props.query,
                    display: visualizationType,
                })
            }
        },
    })),
    afterMount(({ actions, props }) => {
        if (props.query.display) {
            actions.setVisualizationType(props.query.display)
        }

        if (props.query.chartSettings) {
            const { xAxis, yAxis } = props.query.chartSettings

            if (xAxis) {
                actions.updateXSeries(xAxis.column)
            }

            if (yAxis && yAxis.length) {
                yAxis.forEach((axis) => {
                    actions.addYSeries(axis.column, axis.settings)
                })
            }
        }
    }),
    subscriptions(({ props, actions, values }) => ({
        columns: (value: { name: string; type: string }[], oldValue: { name: string; type: string }[]) => {
            // If response is cleared, then don't update any internal values
            if (!values.response || !values.response.results) {
                return
            }

            if (oldValue && oldValue.length) {
                if (JSON.stringify(value) !== JSON.stringify(oldValue)) {
                    actions.clearAxis()
                }
            }

            // Set default axis values
            if (values.response && values.selectedXAxis === null && values.selectedYAxis === null) {
                const types: string[][] = values.response['types']
                const yAxisTypes = types.find((n) => n[1].indexOf('Int') !== -1 || n[1].indexOf('Float') !== -1)
                const xAxisTypes = types.find((n) => n[1].indexOf('Date') !== -1)

                if (yAxisTypes) {
                    actions.addYSeries(yAxisTypes[0])
                }

                if (xAxisTypes) {
                    actions.updateXSeries(xAxisTypes[0])
                }
            }
        },
        selectedXAxis: (value: string | null) => {
            if (props.setQuery) {
                const yColumns =
                    values.selectedYAxis?.filter((n: SelectedYAxis | null): n is SelectedYAxis => Boolean(n)) ?? []
                const xColumn: ChartAxis | undefined = value !== null ? { column: value } : undefined

                props.setQuery({
                    ...props.query,
                    chartSettings: {
                        ...(props.query.chartSettings ?? {}),
                        yAxis: yColumns.map((n) => ({ column: n.name, settings: n.settings })),
                        xAxis: xColumn,
                    },
                })
            }
        },
        selectedYAxis: (value: (SelectedYAxis | null)[] | null) => {
            if (props.setQuery) {
                const yColumns = value?.filter((n: SelectedYAxis | null): n is SelectedYAxis => Boolean(n)) ?? []
                const xColumn: ChartAxis | undefined =
                    values.selectedXAxis !== null ? { column: values.selectedXAxis } : undefined

                props.setQuery({
                    ...props.query,
                    chartSettings: {
                        ...(props.query.chartSettings ?? {}),
                        yAxis: yColumns.map((n) => ({ column: n.name, settings: n.settings })),
                        xAxis: xColumn,
                    },
                })
            }
        },
    })),
])
