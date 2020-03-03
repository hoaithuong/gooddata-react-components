// (C) 2020 GoodData Corporation
import * as React from "react";
import { mount } from "enzyme";
import { withIntl } from "../../../visualizations/utils/intlUtils";
import GeoChartLegendRenderer, { IGeoChartLegendRendererProps } from "../GeoChartLegendRenderer";
import { IGeoData } from "../../../../interfaces/GeoChart";

import PushpinSizeLegend from "../legends/PushpinSizeLegend";
import PushpinCategoryLegend from "../legends/PushpinCategoryLegend";
import { getGeoData } from "../../../../helpers/geoChart/data";
import {
    LOCATION_STRINGS,
    SIZE_NUMBERS,
    COLOR_NUMBERS,
    getExecutionResponse,
    getGeoConfig,
    getExecutionResult,
} from "../../../../../stories/data/geoChart";

interface ILegendFlags {
    hasSizeLegend?: boolean;
    hasColorLegend?: boolean;
}

function createComponent(customProps: IGeoChartLegendRendererProps) {
    const legendProps = {
        ...customProps,
    };
    const Wrapped = withIntl(GeoChartLegendRenderer);
    return mount(<Wrapped {...legendProps} />);
}

function getLegendProps(legendFlags: ILegendFlags): IGeoChartLegendRendererProps {
    const { hasSizeLegend = false, hasColorLegend = false } = legendFlags;
    const geoData: IGeoData = {
        size: hasSizeLegend
            ? {
                  index: 0,
                  name: "size",
                  data: SIZE_NUMBERS,
                  format: "#,##0",
              }
            : undefined,
        color: hasColorLegend
            ? {
                  index: hasSizeLegend ? 1 : 0,
                  name: "color",
                  data: COLOR_NUMBERS,
                  format: "#,##0",
              }
            : undefined,
        location: {
            index: 0,
            name: "location",
            data: LOCATION_STRINGS,
        },
    };
    return {
        geoData,
        config: getGeoConfig({ isWithLocation: true, isWithSize: hasSizeLegend }),
    };
}

describe("GeoChartLegendRenderer", () => {
    it("should render nothing", () => {
        const wrapper = createComponent(getLegendProps({}));
        expect(wrapper.find(".s-geo-legend")).toHaveLength(0);
    });

    it("should render only Size legend", async () => {
        const wrapper = createComponent(getLegendProps({ hasSizeLegend: true }));
        expect(await wrapper.find(".s-geo-legend")).toHaveLength(1);
        expect(await wrapper.find(".s-pushpin-size-legend")).toHaveLength(1);
        expect(await wrapper.find(".color-legend")).toHaveLength(0);
        expect(wrapper.find(".s-geo-category-legend")).toHaveLength(0);
    });

    it("should render only Color legend", async () => {
        const wrapper = createComponent(getLegendProps({ hasColorLegend: true }));
        expect(await wrapper.find(".s-geo-legend")).toHaveLength(1);
        expect(await wrapper.find(".color-legend")).toHaveLength(1);
        expect(await wrapper.find(".s-pushpin-size-legend")).toHaveLength(0);
        expect(wrapper.find(".s-geo-category-legend")).toHaveLength(0);
    });

    it("should render Size and Color legend", async () => {
        const wrapper = createComponent(getLegendProps({ hasColorLegend: true, hasSizeLegend: true }));
        expect(await wrapper.find(".s-geo-legend")).toHaveLength(1);
        expect(await wrapper.find(".color-legend")).toHaveLength(1);
        expect(await wrapper.find(".s-pushpin-size-legend")).toHaveLength(1);
    });

    it("should render Size and Category legend ", () => {
        const execution = {
            executionResponse: getExecutionResponse(true, true, false, true),
            executionResult: getExecutionResult(true, true, false, true),
        };
        const config = getGeoConfig({ isWithLocation: true, isWithSize: true, isWithSegment: true });
        const { mdObject: { buckets = [] } = {} } = config;
        const geoData = getGeoData(buckets, execution);

        const props: IGeoChartLegendRendererProps = {
            config,
            geoData,
            categoryItems: [
                {
                    name: "a",
                    color: "",
                    legendIndex: 0,
                    isVisible: true,
                },
            ],
        };
        const wrapper = createComponent(props);
        const sizeLegend = wrapper.find(PushpinSizeLegend);
        const categoryLegend = wrapper.find(PushpinCategoryLegend);
        expect(wrapper.find(".s-geo-legend")).toHaveLength(1);
        expect(wrapper.find(".s-geo-category-legend")).toHaveLength(1);
        expect(sizeLegend.length).toEqual(1);
        expect(categoryLegend.length).toEqual(1);
    });
});
