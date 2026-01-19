import React, { useState, useEffect } from 'react';
import StringConstants from '../StringConstants';

const GraphControls = ({
  onForceChange,
  onNodeSizeChange,
  onLabelSizeChange,
  onEdgeLengthChange,
  onEdgeThicknessChange,
  initialForceStrength = 50,
  initialNodeSize = 50,
  initialLabelSize = 50,
  initialEdgeLength = 50,
  initialEdgeThickness = 50,
  compact = false,
  mobile = false
}) => {
  const [forceStrength, setForceStrength] = useState(initialForceStrength);
  const [nodeSize, setNodeSize] = useState(initialNodeSize);
  const [labelSize, setLabelSize] = useState(initialLabelSize);
  const [edgeLength, setEdgeLength] = useState(initialEdgeLength);
  const [edgeThickness, setEdgeThickness] = useState(initialEdgeThickness);

  useEffect(() => {
    setForceStrength(initialForceStrength);
  }, [initialForceStrength]);

  useEffect(() => {
    setNodeSize(initialNodeSize);
  }, [initialNodeSize]);

  useEffect(() => {
    setLabelSize(initialLabelSize);
  }, [initialLabelSize]);

  useEffect(() => {
    setEdgeLength(initialEdgeLength);
  }, [initialEdgeLength]);

  useEffect(() => {
    setEdgeThickness(initialEdgeThickness);
  }, [initialEdgeThickness]);

  const handleForceChange = (e) => {
    const value = parseInt(e.target.value);
    setForceStrength(value);
    if (onForceChange) onForceChange(value);
  };

  const handleNodeSizeChange = (e) => {
    const value = parseInt(e.target.value);
    setNodeSize(value);
    if (onNodeSizeChange) onNodeSizeChange(value);
  };

  const handleLabelSizeChange = (e) => {
    const value = parseInt(e.target.value);
    setLabelSize(value);
    if (onLabelSizeChange) onLabelSizeChange(value);
  };

  const handleEdgeLengthChange = (e) => {
    const value = parseInt(e.target.value);
    setEdgeLength(value);
    if (onEdgeLengthChange) onEdgeLengthChange(value);
  };

  const handleEdgeThicknessChange = (e) => {
    const value = parseInt(e.target.value);
    setEdgeThickness(value);
    if (onEdgeThicknessChange) onEdgeThicknessChange(value);
  };

  if (mobile || compact) {
    const isMobileLayout = mobile;

    if (isMobileLayout) {
      return (
        <div className="bg-[#09090B] py-0 px-1 border border-[#707070] mt-auto pb-1 select-none">
          <div className="space-y-0.5">
            <div className="flex flex-row justify-between items-center gap-1">
              {}
              <div className="flex-1" style={{ lineHeight: '0' }}>
                <label className="mb-1 block text-[0.6rem] text-[#B4B4B4] cursor-default">
                  {StringConstants.GRAPH_CONTROLS.FORCE_STRENGTH}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={forceStrength}
                  onChange={handleForceChange}
                  className="custom-slider w-full"
                  aria-label={StringConstants.ARIA.ADJUST_FORCE_STRENGTH}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={forceStrength}
                />
              </div>

              {}
              <div className="flex-1">
                <label className="mb-1 block text-[0.6rem] text-[#B4B4B4] cursor-default">
                  {StringConstants.GRAPH_CONTROLS.NODE_SIZE}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={nodeSize}
                  onChange={handleNodeSizeChange}
                  className="custom-slider w-full"
                  aria-label={StringConstants.ARIA.ADJUST_NODE_SIZE}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={nodeSize}
                />
              </div>

              {}
              <div className="flex-1">
                <label className="mb-1 block text-[0.6rem] text-[#B4B4B4] cursor-default">
                  {StringConstants.GRAPH_CONTROLS.LABEL_SIZE}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={labelSize}
                  onChange={handleLabelSizeChange}
                  className="custom-slider w-full"
                  aria-label={StringConstants.ARIA.ADJUST_LABEL_SIZE}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={labelSize}
                />
              </div>
            </div>

            <div className="flex flex-row justify-between items-center gap-1">
              {}
              <div className="flex-1">
                <label className="mb-1 block text-[0.6rem] text-[#B4B4B4] cursor-default">
                  {StringConstants.GRAPH_CONTROLS.EDGE_LENGTH}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={edgeLength}
                  onChange={handleEdgeLengthChange}
                  className="custom-slider w-full"
                  aria-label={StringConstants.ARIA.ADJUST_EDGE_LENGTH}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={edgeLength}
                />
              </div>

              {}
              <div className="flex-1">
                <label className="mb-1 block text-[0.6rem] text-[#B4B4B4] cursor-default">
                  {StringConstants.GRAPH_CONTROLS.EDGE_THICKNESS}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={edgeThickness}
                  onChange={handleEdgeThicknessChange}
                  className="custom-slider w-full"
                  aria-label={StringConstants.ARIA.ADJUST_EDGE_THICKNESS}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={edgeThickness}
                />
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-[transparent] px-[16px] py-[2px] mt-auto select-none">
          <div>
            {}
            <div className="mb-3 py-0 line-height-1" style={{ lineHeight: '1' }}>
              <label className="-mb-[3px] block text-[10px] text-[#B4B4B4] cursor-default">
                Force Strength
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={forceStrength}
                onChange={handleForceChange}
                className="compact-slider w-full"
                  aria-label={StringConstants.ARIA.ADJUST_FORCE_STRENGTH}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={forceStrength}
              />
            </div>

            {}
            <div className="mb-3 py-0 line-height-1" style={{ lineHeight: '1' }}>
              <label className="-mb-[3px] block text-[10px] text-[#B4B4B4] cursor-default">
                Node Size
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={nodeSize}
                onChange={handleNodeSizeChange}
                className="compact-slider w-full"
                aria-label="Adjust node size"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={nodeSize}
              />
            </div>

            {}
            <div className="mb-3 py-0 line-height-1" style={{ lineHeight: '1' }}>
              <label className="-mb-[3px] block text-[10px] text-[#B4B4B4] cursor-default">
                Label Size
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={labelSize}
                onChange={handleLabelSizeChange}
                className="compact-slider w-full"
                aria-label="Adjust label size"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={labelSize}
              />
            </div>

            {}
            <div className="mb-3 py-0 line-height-1" style={{ lineHeight: '1' }}>
              <label className="-mb-[3px] block text-[10px] text-[#B4B4B4] cursor-default">
                Edge Length
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={edgeLength}
                onChange={handleEdgeLengthChange}
                className="compact-slider w-full"
                aria-label="Adjust edge length"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={edgeLength}
              />
            </div>

            {}
            <div className="mb-3 py-0 line-height-1" style={{ lineHeight: '1' }}>
              <label className="-mb-[3px] block text-[10px] text-[#B4B4B4] cursor-default">
                Edge Thickness
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={edgeThickness}
                onChange={handleEdgeThicknessChange}
                className="compact-slider w-full"
                aria-label="Adjust edge thickness"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={edgeThickness}
              />
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="bg-[#09090B] py-0 px-1 border border-[#707070] select-none">
      <style>{sliderStyles}</style>
      <div className="space-y-0.5">
        {}
        <div>
          <label className="mb-1 block text-[0.7rem] text-[#B4B4B4] cursor-default">
            Force Strength
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={forceStrength}
            onChange={handleForceChange}
            className="custom-slider w-full"
                  aria-label={StringConstants.ARIA.ADJUST_FORCE_STRENGTH}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={forceStrength}
          />
        </div>

        {}
        <div>
          <label className="mb-1 block text-[0.7rem] text-[#B4B4B4] cursor-default">
            Node Size
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={nodeSize}
            onChange={handleNodeSizeChange}
            className="custom-slider w-full"
            aria-label="Adjust node size"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={nodeSize}
          />
        </div>

        {}
        <div>
          <label className="mb-1 block text-[0.7rem] text-[#B4B4B4] cursor-default">
            Label Size
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={labelSize}
            onChange={handleLabelSizeChange}
            className="custom-slider w-full"
            aria-label="Adjust label size"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={labelSize}
          />
        </div>

        {}
        <div>
          <label className="mb-1 block text-[0.7rem] text-[#B4B4B4] cursor-default">
            Edge Length
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={edgeLength}
            onChange={handleEdgeLengthChange}
            className="custom-slider w-full"
            aria-label="Adjust edge length"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={edgeLength}
          />
        </div>

        {}
        <div>
          <label className="mb-1 block text-[0.7rem] text-[#B4B4B4] cursor-default">
            Edge Thickness
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={edgeThickness}
            onChange={handleEdgeThicknessChange}
            className="custom-slider w-full"
            aria-label="Adjust edge thickness"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={edgeThickness}
          />
        </div>
      </div>
    </div>
  );
};

export default GraphControls;