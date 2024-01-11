import axios, { AxiosResponse } from 'axios';
import { Logger } from 'homebridge';
import {
  UponorAPIData,
  UponorJNAPGetResponse,
  UponorJNAPSetPayload,
  UponorJNAPSetResponse,
} from './UponorAPIData';

const UponorActionHeaderName = 'x-jnap-action';
enum UponorActionHeaderValue {
  GET = 'http://phyn.com/jnap/uponorsky/GetAttributes',
  SET = 'http://phyn.com/jnap/uponorsky/SetAttributes',
}

export default class UponorAPI {
  private readonly endpoint: string;

  constructor(
    private readonly log: Logger,
    host: string,
  ) {
    this.endpoint = `http://${host}/JNAP/`;
  }

  async getData(): Promise<UponorAPIData> {
    try {
      const result: AxiosResponse<UponorJNAPGetResponse> = await axios<UponorJNAPGetResponse>({
        method: 'post',
        url: this.endpoint,
        headers: { [UponorActionHeaderName]: UponorActionHeaderValue.GET },
        data: {},
      });
      if (result.data.result !== 'OK') {
        this.log.error('Error response from Uponor API:', result.data);
      }
      return UponorAPIData.fromUponor(result.data);
    } catch (e) {
      this.log.error('Error getting data from Uponor API:', e);
      return UponorAPIData.empty();
    }
  }

  async setData(payload: UponorJNAPSetPayload): Promise<void> {
    try {
      const result: AxiosResponse<UponorJNAPSetResponse> = await axios<UponorJNAPSetResponse>({
        method: 'post',
        url: this.endpoint,
        headers: { [UponorActionHeaderName]: UponorActionHeaderValue.SET },
        data: payload,
      });
      if (result.data.result !== 'OK') {
        this.log.error('Error response from Uponor API:', result.data);
      }
    } catch (e) {
      this.log.error('Error getting data from Uponor API:', e);
    }
  }
}
