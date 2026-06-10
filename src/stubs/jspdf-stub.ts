export class jsPDF {
  constructor(..._args: any[]) {}
  addImage(..._args: any[]) { return this; }
  addPage(..._args: any[]) { return this; }
  setFont(..._args: any[]) { return this; }
  setFontSize(..._args: any[]) { return this; }
  setTextColor(..._args: any[]) { return this; }
  setFillColor(..._args: any[]) { return this; }
  setDrawColor(..._args: any[]) { return this; }
  setLineWidth(..._args: any[]) { return this; }
  text(..._args: any[]) { return this; }
  rect(..._args: any[]) { return this; }
  line(..._args: any[]) { return this; }
  save(_filename?: string) {
    alert('PDF export is not available in this environment.');
  }
  output(..._args: any[]) { return ''; }
  getNumberOfPages() { return 0; }
  setPage(..._args: any[]) { return this; }
  internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
}

export default jsPDF;

export function autoTable(_doc: any, _options: any) {}
