/* eslint-disable camelcase */
import {
    Button, Checkbox, Icon, NativeSelect, Progress,
} from "@equinor/eds-core-react"
import {
    ChangeEvent, Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState,
} from "react"
import { AgGridReact } from "ag-grid-react"
import { GetRowIdFunc, GetRowIdParams, RowNode } from "ag-grid-enterprise"
import styled from "styled-components"
import { external_link } from "@equinor/eds-icons"
import { Project } from "../../models/Project"
import SharePointImport from "./SharePointImport"
import { DriveItem } from "../../models/sharepoint/DriveItem"
import { ImportStatusEnum } from "./ImportStatusEnum"
import { GetProspService } from "../../Services/ProspService"

const ApplyButtonWrapper = styled.div`
    display: flex;
    padding-top: 1em;
`
interface Props {
    setProject: Dispatch<SetStateAction<Project | undefined>>
    project: Project
    driveItems: DriveItem[] | undefined
    check: boolean
}
interface RowData {
    id: string,
    name: string,
    surfState: ImportStatusEnum
    substructureState: ImportStatusEnum
    topsideState: ImportStatusEnum
    transportState: ImportStatusEnum
    sharePointFileName?: string | null
    sharePointFileId?: string | null
    sharepointFileUrl?: string | null
    driveItem: [DriveItem[] | undefined, string | undefined | null]
    fileLink?: string | null
    surfStateChanged: boolean,
    substructureStateChanged: boolean,
    topsideStateChanged: boolean,
    transportStateChanged: boolean
    sharePointFileChanged: boolean,
}
function PROSPCaseList({
    setProject,
    project,
    driveItems,
    check,
}: Props) {
    const gridRef = useRef<any>(null)
    const [rowData, setRowData] = useState<RowData[]>()
    const [isApplying, setIsApplying] = useState<boolean>()
    const casesToRowData = () => {
        if (project.cases) {
            const tableCases: RowData[] = []
            project.cases.forEach((c) => {
                const tableCase: RowData = {
                    id: c.id!,
                    name: c.name ?? "",
                    surfState: SharePointImport.surfStatus(c, project),
                    substructureState: SharePointImport.substructureStatus(c, project),
                    topsideState: SharePointImport.topsideStatus(c, project),
                    transportState: SharePointImport.transportStatus(c, project),
                    sharePointFileId: c.sharepointFileId,
                    sharePointFileName: c.sharepointFileName,
                    sharepointFileUrl: c.sharepointFileUrl,
                    fileLink: c.sharepointFileUrl,
                    driveItem: [driveItems, c.sharepointFileId],
                    surfStateChanged: false,
                    substructureStateChanged: false,
                    topsideStateChanged: false,
                    transportStateChanged: false,
                    sharePointFileChanged: false,
                }
                tableCases.push(tableCase)
            })
            setRowData(tableCases)
        }
    }
    useEffect(() => {
        casesToRowData()
    }, [project, driveItems])

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
    }), [])

    const rowIsChanged = (p: any) => (p.data.surfStateChanged
        || p.data.substructureStateChanged
        || p.data.topsideStateChanged
        || p.data.transportStateChanged
        || p.data.sharePointFileChanged)

    const caseAutoSelect = (nodeId: string) => {
        const rowNode = gridRef.current?.getRowNode(nodeId)

        if (rowIsChanged(rowNode)) {
            rowNode.selected = true
            rowNode.setSelected(true)
            rowNode.selectable = true
        } else {
            rowNode.selected = false
            rowNode.setSelected(false)
            rowNode.selectable = false
        }

        gridRef.current.redrawRows()
    }

    const handleAdvancedSettingsChange = (p: any, value: ImportStatusEnum) => {
        if (project.cases && project.cases !== null && project.cases !== undefined) {
            const caseItem = project.cases.find((el: any) => p.data.id && p.data.id === el.id)
            const rowNode = gridRef.current?.getRowNode(p.node?.data.id)
            if (caseItem) {
                switch (p.column.colId) {
                case "surfState":
                    rowNode.data.surfStateChanged = (SharePointImport.surfStatus(caseItem, project) !== value)
                    break
                case "substructureState":
                    rowNode.data.substructureStateChanged = (
                        SharePointImport.substructureStatus(caseItem, project) !== value)
                    break
                case "topsideState":
                    rowNode.data.topsideStateChanged = (SharePointImport.topsideStatus(caseItem, project) !== value)
                    break
                case "transportState":
                    rowNode.data.transportStateChanged = (SharePointImport.transportStatus(caseItem, project) !== value)
                    break
                default:
                    break
                }
            }
        }
        p.setValue(value)
        caseAutoSelect(p.node?.data.id)
    }

    const advancedSettingsRenderer = (
        p: any,
    ) => {
        if (p.value === ImportStatusEnum.Selected) {
            return (
                <Checkbox
                    checked
                    onChange={() => handleAdvancedSettingsChange(p, ImportStatusEnum.NotSelected)}
                />
            )
        }
        if (p.value === ImportStatusEnum.NotSelected) {
            return (
                <Checkbox
                    checked={false}
                    onChange={() => handleAdvancedSettingsChange(p, ImportStatusEnum.Selected)}
                />
            )
        }
        return (
            <Checkbox
                checked
                onChange={() => handleAdvancedSettingsChange(p, ImportStatusEnum.Selected)}
            />
        )
    }

    const sharePointFileDropdownOptions = (items: DriveItem[]) => {
        const options: JSX.Element[] = []
        items?.forEach((item) => {
            options.push((<option key={item.id} value={item.id!}>{item.name}</option>))
        })
        return options
    }

    const getRowId = useMemo<GetRowIdFunc>(() => (params: GetRowIdParams) => params.data.id, [])

    const getFileLink = (p: any, selectedFileId: any) => {
        const driveItemChosen = p.data?.driveItem[0]
        let link = null
        if (selectedFileId && driveItemChosen !== null && driveItemChosen !== undefined) {
            const item = driveItemChosen.find((el: any) => selectedFileId && selectedFileId === el.id)
            if (item) {
                link = item.sharepointFileUrl
            }
        }
        return link
    }

    const updateFileLink = (nodeId: string, selectedFileId: any) => {
        const rowNode = gridRef.current?.getRowNode(nodeId)
        if (selectedFileId !== "") {
            const link = getFileLink(rowNode, selectedFileId)
            rowNode.setDataValue(
                "fileLink", (
                    <a
                        href={link}
                        aria-label="SharePoint File link"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Icon data={external_link} />
                    </a>),
            )
        } else {
            rowNode.setDataValue("fileLink", null)
        }
    }

    const handleFileChange = (event: ChangeEvent<HTMLSelectElement>, p: any) => {
        const value = { ...p.value }
        value[1] = event.currentTarget.selectedOptions[0].value
        updateFileLink(p.node?.data.id, value[1])
        const rowNode = gridRef.current?.getRowNode(p.node?.data.id)
        if (value[1] === rowNode.data.sharePointFileId) {
            rowNode.data.sharePointFileChanged = false
        } else {
            rowNode.data.sharePointFileChanged = true
        }
        p.setValue(value)
        caseAutoSelect(p.node?.data.id)
    }

    const fileSelectorRenderer = (p: any) => {
        const fileId = p.value[1]
        const items: DriveItem[] = p.value[0]
        return (
            <NativeSelect
                id="sharePointFile"
                label=""
                value={fileId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => handleFileChange(e, p)}
            >
                {sharePointFileDropdownOptions(items)}
                <option aria-label="empty value" key="" value="" />
            </NativeSelect>
        )
    }

    const fileLinkRenderer = (p: any) => {
        const link = getFileLink(p, p.data.driveItem[1])
        if (link) {
            return (
                <a
                    href={link}
                    aria-label="SharePoint File link"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Icon data={external_link} />
                </a>
            )
        }
        return null
    }

    const [columnDefs, setColumnDefs] = useState([
        {
            field: "name",
            flex: 3,
            headerCheckboxSelection: true,
            checkboxSelection: true,
            showDisabledCheckboxes: true,
        },
        {
            field: "driveItem",
            headerName: "SharePoint file",
            cellRenderer: fileSelectorRenderer,
            sortable: false,
            flex: 5,
        },
        {
            field: "fileLink",
            headerName: "Link",
            cellRenderer: fileLinkRenderer,
            width: 60,
        },
        {
            field: "surfState",
            headerName: "Surf",
            flex: 1,
            cellRenderer: advancedSettingsRenderer,
            hide: check,
        },
        {
            field: "substructureState",
            headerName: "Substructure",
            flex: 1,
            cellRenderer: advancedSettingsRenderer,
            hide: check,
        },
        {
            field: "topsideState",
            headerName: "Topside",
            flex: 1,
            cellRenderer: advancedSettingsRenderer,
            hide: check,
        },
        {
            field: "transportState",
            headerName: "Transport",
            flex: 1,
            cellRenderer: advancedSettingsRenderer,
            hide: check,
        },
    ])

    useEffect(() => {
        const assetFields = ["surfState", "substructureState", "topsideState", "transportState"]
        const newColumnDefs = [...columnDefs]
        const columnData: any = []
        newColumnDefs.forEach((cd) => {
            if (assetFields.indexOf(cd.field) > -1) {
                const colDef = { ...cd }
                colDef.hide = !check
                columnData.push(colDef)
            } else {
                columnData.push(cd)
            }
        })
        if (columnData.length > 0) {
            setColumnDefs(columnData)
        }
    }, [check])

    const onGridReady = (params: any) => {
        gridRef.current = params.api
    }

    const gridDataToDtos = (p: Project) => {
        const dtos: any[] = []
        gridRef.current.forEachNode((node: RowNode<RowData>) => {
            const dto: any = {}
            dto.sharePointFileId = node.data?.driveItem[1]
            dto.sharePointFileName = node.data?.driveItem[0]?.find(
                (di) => di.id === dto.sharePointFileId,
            )?.name
            dto.sharepointFileUrl = node.data?.driveItem[0]?.find(
                (di) => di.id === dto.sharePointFileId,
            )?.sharepointFileUrl
            dto.sharePointSiteUrl = p.sharepointSiteUrl
            dto.id = node.data?.id
            dto.surf = node.data?.surfState === ImportStatusEnum.Selected
            dto.substructure = node.data?.substructureState === ImportStatusEnum.Selected
            dto.topside = node.data?.topsideState === ImportStatusEnum.Selected
            dto.transport = node.data?.transportState === ImportStatusEnum.Selected
            if (node.isSelected()) {
                dtos.push(dto)
            }
        })
        return dtos
    }

    const save = useCallback(async (p: Project) => {
        const dtos = gridDataToDtos(p)
        if (dtos.length > 0) {
            setIsApplying(true)
            const newProject = await (await GetProspService()).importFromSharepoint(p.id!, dtos)
            setProject(newProject)
            setIsApplying(false)
        }
    }, [])

    return (
        <>
            <div
                style={{
                    display: "flex", flexDirection: "column", width: "100%",
                }}
                className="ag-theme-alpine"
            >
                <AgGridReact
                    ref={gridRef}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowSelection="multiple"
                    isRowSelectable={rowIsChanged}
                    suppressRowClickSelection
                    animateRows
                    domLayout="autoHeight"
                    onGridReady={onGridReady}
                    getRowId={getRowId}
                />
            </div>
            <ApplyButtonWrapper>
                {!isApplying ? (
                    <Button
                        onClick={() => save(project)}
                        color="secondary"
                    >
                        Apply changes
                    </Button>
                ) : (
                    <Button variant="outlined">
                        <Progress.Dots color="primary" />
                    </Button>
                )}
            </ApplyButtonWrapper>
        </>
    )
}

export default PROSPCaseList
